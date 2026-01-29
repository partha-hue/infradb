import os
import json
import time
import threading
from typing import Dict, Optional

from docker import from_env as docker_from_env, errors as docker_errors
from django.conf import settings

from .models import Deployment
from .encryption import encrypt_obj, decrypt_obj

# Docker client
docker_client = docker_from_env()

DEPLOY_BASE = getattr(settings, "DEPLOY_BASE", os.path.join(settings.BASE_DIR, "deployments"))
os.makedirs(DEPLOY_BASE, exist_ok=True)

def _run_bg(fn, *a, **k):
    t = threading.Thread(target=fn, args=a, kwargs=k, daemon=True)
    t.start()
    return t

def start_provision(deployment_id: str):
    _run_bg(_provision_task, deployment_id)

def start_teardown(deployment_id: str):
    _run_bg(_teardown_task, deployment_id)

def _provision_task(deployment_id: str):
    try:
        d = Deployment.objects.get(id=deployment_id)
    except Deployment.DoesNotExist:
        return

    d.status = "provisioning"
    d.append_log("Provisioner: starting")
    d.save(update_fields=["status"])

    try:
        cfg = decrypt_obj(d.config_encrypted) if d.config_encrypted else {}
    except Exception as e:
        d.append_log(f"Decrypt error: {e}")
        d.status = "failed"
        d.save(update_fields=["status"])
        return

    mode = d.mode or cfg.get("mode", "local")
    db_type = (d.db_type or "").lower()

    try:
        if mode != "local":
            d.append_log("Only local mode supported in this provisioner (cloud-node not implemented).")
            d.status = "failed"
            d.save(update_fields=["status"])
            return

        if db_type == "sqlite":
            path = os.path.join(DEPLOY_BASE, f"{d.user_id}_{d.name}.db")
            open(path, "a").close()
            d.append_log(f"SQLite file created at {path}")
            final = {"db_type": "sqlite", "file": path}
            d.result_encrypted = encrypt_obj(final)
            d.status = "running"
            d.save(update_fields=["result_encrypted", "status"])
            d.append_log("SQLite deployment finished.")
            return

        # MySQL / Postgres via docker
        if db_type in ("mysql", "postgresql", "postgres"):
            if db_type == "mysql":
                image = "mysql:8.0"
                env = {
                    "MYSQL_ROOT_PASSWORD": cfg.get("db_root_password") or cfg.get("db_password") or "inframindroot",
                    "MYSQL_DATABASE": cfg.get("db_name", d.name),
                    "MYSQL_USER": cfg.get("db_user", "inframind"),
                    "MYSQL_PASSWORD": cfg.get("db_password", "inframindpass"),
                }
                exposed = 3306
                data_bind = "/var/lib/mysql"
            else:
                image = "postgres:15"
                env = {
                    "POSTGRES_DB": cfg.get("db_name", d.name),
                    "POSTGRES_USER": cfg.get("db_user", "inframind"),
                    "POSTGRES_PASSWORD": cfg.get("db_password", "inframindpass"),
                }
                exposed = 5432
                data_bind = "/var/lib/postgresql/data"

            d.append_log(f"Pulling image {image}...")
            try:
                docker_client.images.pull(image)
                d.append_log("Image pulled.")
            except docker_errors.APIError as e:
                d.append_log(f"Image pull failed: {e}")
                d.status = "failed"
                d.save(update_fields=["status"])
                return

            container_name = f"inframind_{d.id.hex[:8]}_{int(time.time())}"
            volume_name = f"inframind_vol_{d.id.hex[:8]}"

            try:
                docker_client.volumes.create(name=volume_name, labels={"inframind": "true"})
                d.append_log(f"Volume {volume_name} created.")
            except docker_errors.APIError as e:
                d.append_log(f"Volume creation warning: {e}")

            try:
                container = docker_client.containers.run(
                    image=image,
                    name=container_name,
                    environment=env,
                    detach=True,
                    ports={f"{exposed}/tcp": None},
                    volumes={volume_name: {"bind": data_bind, "mode": "rw"}},
                    labels={"inframind": "true", "deployment_id": str(d.id)},
                )
                d.container_id = container.id
                d.append_log(f"Container started: id={container.id[:12]}")
                d.save(update_fields=["container_id"])
            except docker_errors.APIError as e:
                d.append_log(f"Container start failed: {e}")
                d.status = "failed"
                d.save(update_fields=["status"])
                return

            # wait for host port mapping
            d.append_log("Waiting for host port mapping...")
            host_port = None
            waited = 0
            while waited < 120:
                try:
                    container.reload()
                    ports = container.attrs.get("NetworkSettings", {}).get("Ports", {})
                    mapping = ports.get(f"{exposed}/tcp")
                    if mapping and isinstance(mapping, list) and mapping[0].get("HostPort"):
                        host_port = mapping[0]["HostPort"]
                        break
                except Exception:
                    pass
                time.sleep(2)
                waited += 2

            if not host_port:
                d.append_log("Host port mapping not found. Provisioning failed.")
                d.status = "failed"
                d.save(update_fields=["status"])
                return

            d.append_log(f"DB available at 127.0.0.1:{host_port}")
            final = {
                "db_type": db_type,
                "host": "127.0.0.1",
                "port": int(host_port),
                "db_name": cfg.get("db_name", d.name),
                "db_user": cfg.get("db_user"),
            }
            d.result_encrypted = encrypt_obj(final)
            d.status = "running"
            d.save(update_fields=["result_encrypted", "status"])
            d.append_log("Provisioning finished successfully.")
            return

        else:
            d.append_log(f"Unsupported db_type: {db_type}")
            d.status = "failed"
            d.save(update_fields=["status"])
            return

    except Exception as exc:
        d.append_log(f"Provisioner exception: {exc}")
        d.status = "failed"
        d.save(update_fields=["status"])
        return

def _teardown_task(deployment_id: str):
    try:
        d = Deployment.objects.get(id=deployment_id)
    except Deployment.DoesNotExist:
        return

    d.append_log("Teardown started.")
    try:
        if d.container_id:
            try:
                container = docker_client.containers.get(d.container_id)
                d.append_log(f"Stopping container {d.container_id[:12]}...")
                container.stop(timeout=10)
                d.append_log("Removing container...")
                container.remove(v=True)
                d.append_log("Container removed.")
            except docker_errors.NotFound:
                d.append_log("Container not found.")
            except docker_errors.APIError as e:
                d.append_log(f"Teardown error: {e}")

        # remove volume best-effort
        vol_name = f"inframind_vol_{d.id.hex[:8]}"
        try:
            vol = docker_client.volumes.get(vol_name)
            vol.remove(force=True)
            d.append_log(f"Volume {vol_name} removed.")
        except docker_errors.NotFound:
            d.append_log("Volume not found.")
        except docker_errors.APIError as e:
            d.append_log(f"Volume removal warning: {e}")

        d.status = "deleted"
        d.save(update_fields=["status"])
        d.append_log("Teardown complete.")
    except Exception as exc:
        d.append_log(f"Teardown exception: {exc}")
        d.save(update_fields=["status"])

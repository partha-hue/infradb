import grpc
import engine_pb2
import engine_pb2_grpc
from django.conf import settings

class EngineClient:
    def __init__(self):
        # In production, this address would come from environment variables
        self.channel = grpc.insecure_channel('localhost:50051')
        self.stub = engine_pb2_grpc.QueryEngineStub(self.channel)

    def execute_query(self, query, database_id):
        request = engine_pb2.QueryRequest(
            query=query,
            database_id=str(database_id)
        )
        try:
            response = self.stub.ExecuteQuery(request)
            return {
                "job_id": response.job_id,
                "metadata": [{"name": m.name, "type": m.type} for m in response.metadata],
                "rows_affected": response.rows_affected,
                "execution_time_ms": response.execution_time_ms,
                "error": response.error
            }
        except grpc.RpcError as e:
            return {"error": f"gRPC error: {e.details()}"}

    def explain_query(self, query, database_id):
        request = engine_pb2.QueryRequest(
            query=query,
            database_id=str(database_id)
        )
        try:
            response = self.stub.ExplainQuery(request)
            return {
                "plan_json": response.plan_json,
                "estimated_cost": response.estimated_cost
            }
        except grpc.RpcError as e:
            return {"error": f"gRPC error: {e.details()}"}

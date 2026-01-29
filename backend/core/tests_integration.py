from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from rest_framework import status
import os
from django.conf import settings

from . import views as core_views

class CoreIntegrationTests(APITestCase):
    def setUp(self):
        # Ensure no active connection at start
        try:
            core_views.connections.pop('current', None)
        except Exception:
            pass

    def tearDown(self):
        # Remove created sample DB file if exists
        sample_path = os.path.join(settings.BASE_DIR, 'sample_db.sqlite3')
        if os.path.exists(sample_path):
            try:
                os.remove(sample_path)
            except Exception:
                pass
        try:
            core_views.connections.pop('current', None)
        except Exception:
            pass

    def test_ping(self):
        resp = self.client.get('/ping')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json().get('status'), 'ok')

    def test_run_query_without_connection(self):
        resp = self.client.post('/api/queries/run/', {'query': 'SELECT 1;'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('No active database connection', resp.json().get('error'))

    def test_load_sample_db_and_run_query(self):
        # Load sample DB
        resp = self.client.post('/api/load-sample-db/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.json().get('ok', False))

        # Now run a query
        resp2 = self.client.post('/api/queries/run/', {'query': 'SELECT name, price FROM products;'}, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        data = resp2.json()
        self.assertIn('results', data)
        # Ensure at least one result block with columns
        results = data.get('results', [])
        self.assertTrue(len(results) >= 1)
        if results and results[0].get('columns'):
            self.assertIn('name', [c.lower() for c in results[0]['columns']])

    def test_explain_query(self):
        # Load sample DB
        self.client.post('/load_sample_db')
        resp = self.client.post('/api/queries/explain/', {'query': 'SELECT * FROM products;'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertIn('plan', data)

    def test_save_and_get_saved_queries(self):
        # Save a query
        payload = {'title': 'my test', 'query': 'SELECT 1;', 'is_public': False}
        resp = self.client.post('/api/queries/save/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        # Get saved queries
        resp2 = self.client.get('/api/queries/saved/')
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        arr = resp2.json()
        self.assertTrue(any(q.get('title') == 'my test' for q in arr))

    def test_query_history_after_run(self):
        self.client.post('/load_sample_db')
        self.client.post('/run_query', {'query': 'SELECT 1;'}, format='json')
        resp = self.client.get('/api/queries/history/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        arr = resp.json()
        self.assertTrue(isinstance(arr, list))

    def test_import_csv(self):
        # Load sample DB
        self.client.post('/load_sample_db')
        csv_content = b"name,price\nTestProd,12.34\n"
        f = SimpleUploadedFile('test.csv', csv_content, content_type='text/csv')
        resp = self.client.post('/api/import-csv/', {'file': f}, format='multipart')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertIn('message', data)
        self.assertIn('tablename', data)
        self.assertGreater(data.get('rows_imported', 0), 0)

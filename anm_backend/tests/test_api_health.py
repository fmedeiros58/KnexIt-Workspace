import unittest

from anm_backend.api.routes_admin import health
from anm_backend.main import create_app


class DummyRequest:
    def __init__(self, app):
        self.app = app


class ApiHealthTests(unittest.TestCase):
    def test_healthcheck_endpoints(self) -> None:
        app = create_app()

        admin = health(DummyRequest(app))
        self.assertTrue(admin.get("api_ok"))
        self.assertIn("engine_ok", admin)
        self.assertIn("engine_latency_ms", admin)
        self.assertIn("engine_model", admin)

        health_route = next(route for route in app.routes if getattr(route, "path", "") == "/healthz")
        payload = health_route.endpoint()
        self.assertTrue(payload.get("ok"))


if __name__ == "__main__":
    unittest.main()

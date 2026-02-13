import os


def _patch_requests_backend_base() -> None:
    try:
        import requests  # type: ignore
    except Exception:
        return

    backend_port = (os.environ.get("BIOFORGER_BACKEND_PORT") or "").strip()
    if not backend_port:
        return

    default_base = "http://127.0.0.1:8778"
    target_base = f"http://127.0.0.1:{backend_port}"
    if target_base == default_base:
        return

    original_request = requests.sessions.Session.request

    def _patched_request(self, method, url, *args, **kwargs):
        if isinstance(url, str):
            url = url.replace(default_base, target_base)
        return original_request(self, method, url, *args, **kwargs)

    requests.sessions.Session.request = _patched_request


_patch_requests_backend_base()

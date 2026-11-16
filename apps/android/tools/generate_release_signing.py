#!/usr/bin/env python3
"""Derive a reproducible Android signing key from ONE GitHub Actions secret.
Keep ANDROID_SIGNING_SEED private and unchanged forever to support in-place APK updates.
No private key or seed is committed to GitHub; outputs are local to the CI runner.
"""
import datetime as dt
import hashlib
import os
from pathlib import Path
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

seed = os.getenv("ANDROID_SIGNING_SEED", "")
if len(seed) < 32:
    raise SystemExit("ANDROID_SIGNING_SEED is missing or too short; configure a 32+ character GitHub Actions secret.")
# NIST P-256 subgroup order; same seed -> same signing key and certificate on all runners.
order = int("FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551", 16)
seed_digest = hashlib.sha512(("turkuaz3d-android-update-v1:" + seed).encode()).digest()
scalar = int.from_bytes(seed_digest, "big") % (order - 1) + 1
key = ec.derive_private_key(scalar, ec.SECP256R1())
name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Turkuaz 3D Web Android Release"),
                  x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Turkuaz 3D")])
now = dt.datetime(2025, 1, 1, tzinfo=dt.timezone.utc)
cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
        .public_key(key.public_key()).serial_number(0x4a01c44b8a7128077f332ea1)
        .not_valid_before(now).not_valid_after(dt.datetime(2045, 1, 1, tzinfo=dt.timezone.utc))
        .sign(key, hashes.SHA256()))
passphrase = hashlib.sha256(("turkuaz3d-store-password-v1:" + seed).encode()).hexdigest()
outfile = Path(__file__).parent.parent / "app" / "release-signing.p12"
outfile.write_bytes(pkcs12.serialize_key_and_certificates(
    name=b"turkuaz3d", key=key, cert=cert, cas=None,
    encryption_algorithm=serialization.BestAvailableEncryption(passphrase.encode())))
with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as file:
    file.write("ANDROID_SIGNING_PASSWORD=" + passphrase + "\n")
print("Stable Android signing identity generated on runner, not uploaded.")

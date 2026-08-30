# -*- coding: utf-8 -*-
"""
connectors/network_doctor.py — Pre-Flight Network & Firewall Diagnostic Engine
-------------------------------------------------------------------------------
Executes a 3-stage pre-flight diagnostic probe before database/API authentication:
1. DNS Name Resolution (checks hostname validity)
2. TCP Port Handshake (checks if port is open or blocked by AWS Security Group / Azure NSG)
3. Latency & Firewall Block Analysis (gives actionable IP whitelisting recommendations)
"""

import socket
import time
from typing import Dict, Any, Optional


class NetworkDoctor:
    """
    Diagnostic tool to verify connectivity to source hosts and ports before attempting DB login.
    Returns clear, actionable diagnosis instead of cryptic driver timeout messages.
    """

    @staticmethod
    def diagnose_target(host: str, port: int, timeout_sec: float = 3.0) -> Dict[str, Any]:
        """
        Runs comprehensive connectivity diagnostic against target host and port.
        """
        clean_host = host.strip()
        # Strip URL protocol prefixes if user typed https:// or jdbc:...
        if "://" in clean_host:
            clean_host = clean_host.split("://")[1].split("/")[0].split(":")[0]

        report = {
            "target": f"{clean_host}:{port}",
            "dns_resolved": False,
            "resolved_ip": None,
            "port_open": False,
            "latency_ms": None,
            "status": "FAILED",
            "message": "",
            "actionable_guidance": None
        }

        # Stage 1: DNS Resolution
        t0 = time.time()
        try:
            ip_address = socket.gethostbyname(clean_host)
            report["dns_resolved"] = True
            report["resolved_ip"] = ip_address
        except socket.gaierror as e:
            report["status"] = "DNS_ERROR"
            report["message"] = f"DNS resolution failed for host '{clean_host}'."
            report["actionable_guidance"] = (
                f"Hostname '{clean_host}' could not be resolved. Please verify the host address, "
                "check your internet connection, or connect to your corporate VPN."
            )
            return report

        # Stage 2: TCP Socket Handshake
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout_sec)

        try:
            sock.connect((ip_address, int(port)))
            report["port_open"] = True
            report["latency_ms"] = round((time.time() - t0) * 1000, 2)
            report["status"] = "REACHABLE"
            report["message"] = f"Target {clean_host}:{port} ({ip_address}) is reachable. Port is open (Latency: {report['latency_ms']}ms)."
            sock.close()
            return report
        except socket.timeout:
            report["status"] = "PORT_FILTERED_TIMEOUT"
            report["message"] = f"Connection to {clean_host}:{port} timed out after {timeout_sec}s."
            report["actionable_guidance"] = (
                f"Host resolved to {ip_address}, but Port {port} is blocked by a firewall, "
                f"AWS Security Group, or Azure Network Security Group (NSG). "
                f"Please ensure outbound Port {port} is open and whitelist your IP."
            )
            return report
        except ConnectionRefusedError:
            report["status"] = "PORT_CLOSED"
            report["message"] = f"Connection to {clean_host}:{port} was actively refused."
            report["actionable_guidance"] = (
                f"Host is reachable, but the database service is not actively listening on Port {port}. "
                "Verify that the database instance is running and the port number is correct."
            )
            return report
        except Exception as e:
            report["status"] = "SOCKET_ERROR"
            report["message"] = f"Network handshake error: {str(e)}"
            report["actionable_guidance"] = f"Encountered unexpected network socket exception: {str(e)}"
            return report
        finally:
            try:
                sock.close()
            except Exception:
                pass

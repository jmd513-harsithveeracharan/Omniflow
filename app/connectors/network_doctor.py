# -*- coding: utf-8 -*-
"""
connectors/network_doctor.py — Robust Pre-Flight Network & Firewall Diagnostic Engine
-------------------------------------------------------------------------------------
Executes a 3-stage pre-flight diagnostic probe before database/API authentication:
1. URL & Host Parsing (Strips jdbc: prefixes, http/https schemes, port suffixes, path slashes)
2. DNS Name Resolution (checks IPv4/IPv6 hostname validity)
3. TCP Port Handshake & Latency Analysis (diagnoses firewall/NSG/VPN blocks with actionable guidance)
"""

import socket
import time
import re
from typing import Dict, Any, Optional


class NetworkDoctor:
    """
    Diagnostic engine to verify connectivity to source hosts and ports before attempting DB login.
    Returns clear, actionable diagnosis instead of cryptic driver timeout messages.
    """

    @staticmethod
    def parse_host_port(raw_host: str, raw_port: Any, default_port: int = 5432) -> tuple[str, int]:
        """Cleans and extracts pure host string and integer port from any user input format."""
        clean = str(raw_host).strip()
        
        # Strip JDBC and HTTP prefixes
        clean = re.sub(r'^(jdbc:[a-zA-Z0-9_-]+://|https?://|//)', '', clean, flags=re.IGNORECASE)
        # Strip path or query parameters
        clean = clean.split('/')[0].split('?')[0].split(';')[0]
        
        # Check if port is embedded in host string (e.g. host.domain.com:1433)
        if ':' in clean:
            parts = clean.split(':')
            clean = parts[0]
            if len(parts) > 1 and parts[1].isdigit():
                return clean, int(parts[1])
                
        # Parse explicit port
        port = int(raw_port) if str(raw_port).strip().isdigit() else default_port
        return clean, port

    @classmethod
    def diagnose_target(cls, host: str, port: Any = 5432, timeout_sec: float = 3.0) -> Dict[str, Any]:
        """
        Runs comprehensive connectivity diagnostic against target host and port.
        """
        clean_host, clean_port = cls.parse_host_port(host, port)

        report = {
            "target": f"{clean_host}:{clean_port}",
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
            sock.connect((ip_address, clean_port))
            report["port_open"] = True
            report["latency_ms"] = round((time.time() - t0) * 1000, 2)
            report["status"] = "REACHABLE"
            report["message"] = f"Target {clean_host}:{clean_port} ({ip_address}) is reachable. Port is open (Latency: {report['latency_ms']}ms)."
            return report
        except socket.timeout:
            report["status"] = "PORT_FILTERED_TIMEOUT"
            report["message"] = f"Connection to {clean_host}:{clean_port} timed out after {timeout_sec}s."
            report["actionable_guidance"] = (
                f"Host resolved to {ip_address}, but Port {clean_port} is blocked by a firewall, "
                f"AWS Security Group, or Azure Network Security Group (NSG). "
                f"Please ensure outbound Port {clean_port} is open and whitelist your client IP."
            )
            return report
        except ConnectionRefusedError:
            report["status"] = "PORT_CLOSED"
            report["message"] = f"Connection to {clean_host}:{clean_port} was actively refused."
            report["actionable_guidance"] = (
                f"Host is reachable, but the database service is not actively listening on Port {clean_port}. "
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

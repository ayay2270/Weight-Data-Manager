import socket
import uvicorn


def lan_ip():
    sock=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8",80)); return sock.getsockname()[0]
    except OSError:
        try: return socket.gethostbyname(socket.gethostname())
        except OSError: return "HOST-PC-IP"
    finally: sock.close()


if __name__=="__main__":
    ip=lan_ip()
    print("\nWeight Data Manager is running.\n")
    print("Local:             http://localhost:8000")
    print(f"Department Network: http://{ip}:8000")
    print("\nKeep this window open. Press Ctrl+C to stop.\n")
    uvicorn.run("app.main:app",host="0.0.0.0",port=8000,reload=False,log_level="info")


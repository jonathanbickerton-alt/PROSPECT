import subprocess
import sys
import os

def main():
    """
    Launches the Streamlit application.
    This script can be packaged with PyInstaller to create a standalone executable.
    """
    # Get the directory of the current script
    current_dir = os.path.dirname(os.path.abspath(__file__))
    app_path = os.path.join(current_dir, "app.py")
    
    print(f"Starting Streamlit app at {app_path}...")
    
    # Run the streamlit app using subprocess
    try:
        subprocess.run([sys.executable, "-m", "streamlit", "run", app_path], check=True)
    except KeyboardInterrupt:
        print("\nApp stopped by user.")
    except Exception as e:
        print(f"Error running the app: {e}")

if __name__ == "__main__":
    main()

import time
import os
from playwright.sync_api import sync_playwright
from PIL import Image

def capture():
    os.makedirs("assets/screenshots", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=2)
        page = context.new_page()
        
        print("Navigating to http://localhost:8085/ ...")
        page.goto("http://localhost:8085/")
        time.sleep(1)
        
        # Inject logged-in user state
        page.evaluate("""() => {
            localStorage.setItem('fabric_ai_user', JSON.stringify({
                name: 'Bheesetti Harsith',
                email: 'harsith.veer@microsoft.com',
                provider: 'microsoft'
            }));
        }""")
        page.reload(wait_until="networkidle")
        time.sleep(2)
        
        # 1. Full Studio Playground View
        full_path = "assets/screenshots/live_playground_full.png"
        page.screenshot(path=full_path)
        print(f"Captured: {full_path}")
        
        # 2. Crop Center Studio Dock & Hero
        img = Image.open(full_path)
        w, h = img.size
        dock_crop = img.crop((int(w * 0.20), int(h * 0.65), int(w * 0.95), int(h * 0.95)))
        dock_crop.save("assets/screenshots/live_prompt_dock_clean.png")
        print("Cropped: assets/screenshots/live_prompt_dock_clean.png")
        
        # 3. Navigate to 'New pipeline' / DAG View
        try:
            dag_link = page.locator("text=New pipeline").first
            if dag_link.is_visible():
                dag_link.click()
                time.sleep(2)
                page.screenshot(path="assets/screenshots/live_dag_full.png")
                print("Captured: assets/screenshots/live_dag_full.png")
        except Exception as e:
            print("DAG click error:", e)

        # 4. Navigate to 'Dashboard' or 'My apps & items'
        try:
            items_link = page.locator("text=My apps & items").first
            if items_link.is_visible():
                items_link.click()
                time.sleep(2)
                page.screenshot(path="assets/screenshots/live_items_full.png")
                print("Captured: assets/screenshots/live_items_full.png")
        except Exception as e:
            print("Items click error:", e)
            
        browser.close()
        print("Screenshot capture complete!")

if __name__ == "__main__":
    capture()

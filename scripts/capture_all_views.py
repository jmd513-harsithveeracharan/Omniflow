import time
import os
from playwright.sync_api import sync_playwright
from PIL import Image

def capture_all_views():
    os.makedirs("assets/screenshots", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=2)
        page = context.new_page()
        
        page.goto("http://localhost:8085/")
        time.sleep(1)
        
        # Inject auth
        page.evaluate("""() => {
            localStorage.setItem('fabric_ai_user', JSON.stringify({
                name: 'Bheesetti Harsith',
                email: 'bheesetti.harsith@microsoft.com',
                provider: 'microsoft'
            }));
        }""")
        page.reload(wait_until="networkidle")
        time.sleep(2)
        
        # 1. Main Playground
        page.screenshot(path="assets/screenshots/live_main_playground.png")
        print("Captured: live_main_playground.png")
        
        # 2. Click Skills
        try:
            page.locator("text=Skills").first.click()
            time.sleep(1.5)
            page.screenshot(path="assets/screenshots/live_skills_view.png")
            print("Captured: live_skills_view.png")
        except Exception as e:
            print("Skills error:", e)

        # 3. Click Workspaces
        try:
            page.locator("text=Workspaces").first.click()
            time.sleep(1.5)
            page.screenshot(path="assets/screenshots/live_workspaces_view.png")
            print("Captured: live_workspaces_view.png")
        except Exception as e:
            print("Workspaces error:", e)

        # 4. Click Customize
        try:
            page.locator("text=Customize").first.click()
            time.sleep(1.5)
            page.screenshot(path="assets/screenshots/live_customize_view.png")
            print("Captured: live_customize_view.png")
        except Exception as e:
            print("Customize error:", e)

        # 5. Detail High-Res Crops with Pillow
        img = Image.open("assets/screenshots/live_main_playground.png")
        w, h = img.size
        
        # Crop 1: Centered Prompt Dock Bar
        dock_crop = img.crop((int(w * 0.25), int(h * 0.35), int(w * 0.85), int(h * 0.70)))
        dock_crop.save("assets/screenshots/live_dock_crop_hd.png")
        print("Cropped: live_dock_crop_hd.png")
        
        # Crop 2: Left Sidebar Navigation
        sidebar_crop = img.crop((0, 0, int(w * 0.20), h))
        sidebar_crop.save("assets/screenshots/live_sidebar_crop_hd.png")
        print("Cropped: live_sidebar_crop_hd.png")
        
        browser.close()
        print("All live screenshots captured successfully!")

if __name__ == "__main__":
    capture_all_views()

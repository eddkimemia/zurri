from playwright.sync_api import sync_playwright
import time

def run_cuj(page):
    page.goto("http://localhost:3000/auth.html")
    page.wait_for_timeout(1000)

    # Register
    page.click("#tabRegister")
    page.fill("#regName", "Final UI Test")
    unique_phone = str(int(time.time()))[-9:]
    page.fill("#regPhone", unique_phone)
    page.select_option("#regCounty", "Nairobi")
    page.fill("#regPassword", "password123")
    page.fill("#regConfirmPassword", "password123")
    page.check("#regTerms")
    page.click("#registerBtn")

    page.wait_for_selector("#successPanel.active", state="visible")
    page.screenshot(path="final_account_created.png")

    # Activation UI
    page.click("#paymentBtn")
    page.wait_for_timeout(1000)
    page.screenshot(path="final_stk_sent.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            run_cuj(page)
        finally:
            browser.close()

# -*- coding: utf-8 -*-
"""
TAREEQ - سحب جروبات فيسبوك (محسّن)
====================================
يسحب كل جروباتك من صفحة Facebook Groups ويحفظها في ملف tareeq-groups.txt
(سطر لكل جروب: "اسم | https://www.facebook.com/groups/ID/")

الاستخدام:
  python scrape_fb_groups.py            # سحب تلقائي (scroll + collect)
  python scrape_fb_groups.py --manual   # وضع manual: you scroll manually, script collects in background
  python scrape_fb_groups.py --collect  # collect-only: جمع من الصفحة الحالية (بدون scroll)

الخطوات:
  1. ثبّت المتطلبات (مرة واحدة):
        pip install selenium webdriver-manager
  2. شغّل:  python scrape_fb_groups.py
  3. سجّل دخولك في Facebook (بما في ذلك 2FA/CAPTCHA) في نافذة Chrome.
  4. بعد تسجيل الدخول، اضغط Enter.
  5. السكربت سيسحب تلقائياً ويحفظ الملف على سطح المكتب.
  6. لوحة TAREEQ -> جروبات فيسبوك -> "رفع ملف" -> اختر tareeq-groups.txt -> "إضافة الكل"

ملاحظة: Facebook قد يطلب "تأكيد أنك لست روبوت" (CAPTCHA) - أكمله يدوياً.
"""
import os
import re
import time
import sys
import argparse

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options
    from webdriver_manager.chrome import ChromeDriverManager
except ImportError:
    print("❌ selenium / webdriver_manager غير مثبتة.")
    print("   ثبّتها بـ:  pip install selenium webdriver-manager")
    sys.exit(1)

OUT_FILE = os.path.join(os.path.expanduser("~"), "Desktop", "tareeq-groups.txt")
GROUPS_URL = "https://www.facebook.com/groups/"
LOGIN_URL = "https://www.facebook.com/login"

GROUP_RE = re.compile(r"/groups/(\d{5,})(?:/|$|[?#])")


def collect_from_dom(driver, collected):
    """Collect group links from current DOM state."""
    anchors = driver.find_elements(By.CSS_SELECTOR, 'a[href*="/groups/"]')
    for a in anchors:
        try:
            h = a.get_attribute("href") or ""
            m = GROUP_RE.search(h)
            if not m:
                continue
            gid = m.group(1)
            name = (a.get_attribute("aria-label") or a.text or "").strip().replace("\n", " ")[:120]
            if gid not in collected or (name and len(name) > len(collected.get(gid, {}).get("n", ""))):
                collected[gid] = {"n": name or gid}
        except Exception:
            pass
    # Also try divs with role="link" or data attributes
    try:
        divs = driver.find_elements(By.CSS_SELECTOR, 'div[role="link"][data-visualcompletion]')
        for d in divs:
            try:
                txt = (d.text or "").strip()[:120]
                # find any group link inside
                inner = d.find_elements(By.CSS_SELECTOR, 'a[href*="/groups/"]')
                for a in inner:
                    h = a.get_attribute("href") or ""
                    m = GROUP_RE.search(h)
                    if m:
                        gid = m.group(1)
                        name = (a.get_attribute("aria-label") or a.text or txt or "").strip().replace("\n", " ")[:120]
                        if gid not in collected or (name and len(name) > len(collected.get(gid, {}).get("n", ""))):
                            collected[gid] = {"n": name or gid}
            except Exception:
                pass
    except Exception:
        pass


def scroll_all_containers(driver):
    """Try scrolling all possible scrollable containers."""
    # window + document
    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    try:
        se = driver.find_element(By.TAG_NAME, "html")
        driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", se)
    except Exception:
        pass
    try:
        body = driver.find_element(By.TAG_NAME, "body")
        driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", body)
    except Exception:
        pass
    # role="main"
    try:
        main = driver.find_element(By.CSS_SELECTOR, '[role="main"]')
        driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", main)
    except Exception:
        pass
    # any div with overflow auto/scroll
    try:
        driver.execute_script("""
            document.querySelectorAll('div').forEach(d => {
                const s = getComputedStyle(d);
                if (s.overflowY === 'auto' || s.overflowY === 'scroll') {
                    d.scrollTop = d.scrollHeight;
                }
            });
        """)
    except Exception:
        pass
    # click "See more" / "Load more" / "Show more" buttons
    try:
        for btn in driver.find_elements(By.XPATH, "//*[contains(text(),'See more') or contains(text(),'Load more') or contains(text(),'Show more') or contains(text(),'عرض المزيد') or contains(text(),'المزيد')]"):
            try:
                btn.click()
                time.sleep(0.5)
            except Exception:
                pass
    except Exception:
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manual", action="store_true", help="وضع manual: you scroll manually, script collects in background")
    parser.add_argument("--collect", action="store_true", help="collect-only: collect from current page (no scroll)")
    args = parser.parse_args()

    print("=" * 60)
    print("TAREEQ - سحب جروبات فيسبوك (محسّن)")
    print("=" * 60)

    opts = Options()
    opts.add_argument("--start-maximized")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)

    print("\n[1/5] فتح Chrome...")
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=opts)
    driver.set_page_load_timeout(60)

    print("[2/5] فتح Facebook login...")
    driver.get(LOGIN_URL)
    print("\n" + "=" * 60)
    print("  سجّل دخولك في Facebook (بما في ذلك 2FA/CAPTCHA) في نافذة Chrome.")
    print("  بعد تسجيل الدخول بنجاح، ارجع إلى هذه النافذة واضغط Enter.")
    print("=" * 60)
    input("\n  [اضغط Enter بعد تسجيل الدخول] > ")

    if "login" in driver.current_url.lower():
        print("❌ لازم تسجل دخول أولاً. أعد المحاولة.")
        driver.quit()
        sys.exit(1)

    print("[3/5] فتح صفحة Groups...")
    driver.get(GROUPS_URL)
    time.sleep(5)

    collected = {}

    if args.collect:
        print("[4/5] وضع collect-only: جمع من الصفحة الحالية...")
        collect_from_dom(driver, collected)
    elif args.manual:
        print("[4/5] وضع manual: مرّر للأسفل (scroll) في نافذة Chrome.")
        print("      السكربت يجمع تلقائياً كل 2 ثانية. اضغط Ctrl+C عند الانتهاء.")
        try:
            while True:
                collect_from_dom(driver, collected)
                print(f"   ... {len(collected)} جروب حتى الآن", end="\r")
                time.sleep(2)
        except KeyboardInterrupt:
            print("\n   تم إيقاف collection manually.")
    else:
        print("[4/5] التمرير لتحميل كل الجروبات (قد يأخذ 3-8 min)...")
        last_count = -1
        same_rounds = 0
        for i in range(500):
            collect_from_dom(driver, collected)

            scroll_all_containers(driver)
            time.sleep(1.5)

            if len(collected) == last_count:
                same_rounds += 1
                if same_rounds >= 10:
                    break
            else:
                same_rounds = 0
            last_count = len(collected)

            if i % 5 == 0:
                print(f"   ... {len(collected)} جروب حتى الآن (round {i})")

        # final collect
        collect_from_dom(driver, collected)

    print(f"\n[5/5] تم سحب {len(collected)} جروب.")

    if not collected:
        print("❌ لم يُعثر على أي جروب. تأكد أنك في صفحة Groups (وليس جروب محدد).")
        driver.quit()
        sys.exit(1)

    # save to file
    lines = [f"{v['n']} | https://www.facebook.com/groups/{k}/" for k, v in collected.items()]
    with open(OUT_FILE, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")

    print(f"✅ حُفظ {len(lines)} جروب في:\n   {OUT_FILE}")
    print("\nالخطوات التالية:")
    print("  1. افتح لوحة TAREEQ -> جروبات فيسبوك")
    print("  2. 'رفع ملف' -> اختر tareeq-groups.txt")
    print("  3. 'إضافة الكل'")

    driver.quit()
    print("\nتم.")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nأُلغي.")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ خطأ: {e}")
        sys.exit(1)

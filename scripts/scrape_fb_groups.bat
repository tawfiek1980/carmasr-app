@echo off
chcp 65001 >nul
python "%~dp0scrape_fb_groups.py"
pause

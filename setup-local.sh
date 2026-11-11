#!/bin/bash
set -e

echo "========================================"
echo "  طريق TAREEQ - Local Setup Script"
echo "========================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Check Node.js
echo -e "\n${YELLOW}[1/5] فحص Node.js...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js غير موجود. حمّله من: https://nodejs.org${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v)${NC}"

# 2. Install dependencies
echo -e "\n${YELLOW}[2/5] تثبيت الحزم...${NC}"
npm install
echo -e "${GREEN}✅ الحزم مثبتة${NC}"

# 3. Check .env
echo -e "\n${YELLOW}[3/5] فحص ملف البيئة...${NC}"
if [ ! -f .env ]; then
  cp .env.example .env 2>/dev/null || true
  echo -e "${YELLOW}⚠️  أنشئ ملف .env وأضف متغيرات Firebase${NC}"
fi
echo -e "${GREEN}✅ .env موجود${NC}"

# 4. Build
echo -e "\n${YELLOW}[4/5] بناء المشروع...${NC}"
npm run build
echo -e "${GREEN}✅ البناء ناجح${NC}"

# 5. Start
echo -e "\n${YELLOW}[5/5] تشغيل السيرفر...${NC}"
echo -e "${GREEN}========================================"
echo -e "  ✅ المشروع جاهز!"
echo -e "  🌐 افتح: http://localhost:5173"
echo -e "========================================${NC}\n"
npm run dev

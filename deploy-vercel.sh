#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================"
echo -e "  طريق TAREEQ - Vercel Deploy Script"
echo -e "========================================${NC}\n"

# 1. Check vercel CLI
if ! command -v vercel &> /dev/null; then
  echo -e "${YELLOW}تثبيت Vercel CLI...${NC}"
  npm install -g vercel
fi

# 2. Build check
echo -e "${YELLOW}[1/3] فحص البناء...${NC}"
npm run build
echo -e "${GREEN}✅ البناء ناجح${NC}"

# 3. Login if needed
echo -e "\n${YELLOW}[2/3] تسجيل الدخول لـ Vercel...${NC}"
vercel whoami 2>/dev/null || vercel login

# 4. Deploy — using env vars already configured on Vercel (no secrets on the command line)
echo -e "\n${YELLOW}[3/3] جارٍ الرفع إلى الإنتاج...${NC}"
vercel --prod

echo -e "\n${GREEN}🎉 تم الرفع بنجاح!${NC}"

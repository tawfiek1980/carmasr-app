import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { trackEvent } from "./lib/analytics";
import { applyDemoParam } from "./lib/demoMode";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import ScrollToTop from "./components/ScrollToTop";
import ErrorBoundary from "./components/ErrorBoundary";
import PushSetup from "./components/PushSetup";
import PushStatusBanner from "./components/PushStatusBanner";
import InstallPrompt from "./components/InstallPrompt";
import AiAssistantChat from "./components/AiAssistantChat";
import WhatsAppFloat from "./components/WhatsAppFloat";
import AdminPinGate from "./components/admin/AdminPinGate";
import SplashScreen from "./components/SplashScreen";
import { ListingCardSkeleton, PageSkeleton } from "./components/Skeleton";
import { useAndroidBackButton } from "./hooks/useAndroidBackButton";
import { useAuth } from "./contexts/AuthContext";
import { HOME_VERSION } from "./lib/config";
import { isNativeApp } from "./services/devicePush";

const Home           = lazy(() => import("./pages/Home"));
const Join           = lazy(() => import("./pages/Join"));
const PlatformLanding = lazy(() => import("./pages/PlatformLanding"));
const Vehicles       = lazy(() => import("./pages/Vehicles"));
const Equipment      = lazy(() => import("./pages/Equipment"));
const Loads          = lazy(() => import("./pages/Loads"));
const Jobs           = lazy(() => import("./pages/Jobs"));
const Services       = lazy(() => import("./pages/Services"));
const SpareParts     = lazy(() => import("./pages/SpareParts"));
const Finance        = lazy(() => import("./pages/Finance"));
const Emergency      = lazy(() => import("./pages/Emergency"));
const Profile        = lazy(() => import("./pages/Profile"));
const Login          = lazy(() => import("./pages/Login"));
const Register       = lazy(() => import("./pages/Register"));
const PostListing    = lazy(() => import("./pages/PostListing"));
const EditListing    = lazy(() => import("./pages/EditListing"));
const EditLoad       = lazy(() => import("./pages/EditLoad"));
const LoadDetail     = lazy(() => import("./pages/LoadDetail"));
const ListingDetail  = lazy(() => import("./pages/ListingDetail"));
const AdRedirect     = lazy(() => import("./pages/AdRedirect"));
const Search         = lazy(() => import("./pages/Search"));
const Favorites      = lazy(() => import("./pages/Favorites"));
const Contact        = lazy(() => import("./pages/Contact"));
const ShareApp       = lazy(() => import("./pages/ShareApp"));
const CompleteProfile = lazy(() => import("./pages/CompleteProfile"));
const NotFound404    = lazy(() => import("./pages/system/NotFound404"));
const ServerError    = lazy(() => import("./pages/system/ServerError"));
const Maintenance    = lazy(() => import("./pages/system/Maintenance"));
const Offline        = lazy(() => import("./pages/system/Offline"));
const ComingSoon     = lazy(() => import("./pages/system/ComingSoon"));
const MakeAdmin      = lazy(() => import("./pages/system/MakeAdmin"));

const PrivacyPolicy          = lazy(() => import("./pages/legal/PrivacyPolicy"));
const TermsConditions        = lazy(() => import("./pages/legal/TermsConditions"));
const CookiePolicy           = lazy(() => import("./pages/legal/CookiePolicy"));
const AcceptableUsePolicy    = lazy(() => import("./pages/legal/AcceptableUsePolicy"));
const ContentPolicy          = lazy(() => import("./pages/legal/ContentPolicy"));
const FraudPreventionPolicy  = lazy(() => import("./pages/legal/FraudPreventionPolicy"));
const FinancePolicy          = lazy(() => import("./pages/legal/FinancePolicy"));
const VehicleListingPolicy   = lazy(() => import("./pages/legal/VehicleListingPolicy"));
const MarketplacePolicy      = lazy(() => import("./pages/legal/MarketplacePolicy"));
const UserSafetyPolicy       = lazy(() => import("./pages/legal/UserSafetyPolicy"));
const DataProtectionPolicy   = lazy(() => import("./pages/legal/DataProtectionPolicy"));
const AccountDeletionPolicy  = lazy(() => import("./pages/legal/AccountDeletionPolicy"));
const RefundPolicy           = lazy(() => import("./pages/legal/RefundPolicy"));
const CommunityGuidelines    = lazy(() => import("./pages/legal/CommunityGuidelines"));
const CopyrightPolicy        = lazy(() => import("./pages/legal/CopyrightPolicy"));

const AboutUs       = lazy(() => import("./pages/company/AboutUs"));
const MissionVision = lazy(() => import("./pages/company/MissionVision"));
const WhyTareeq     = lazy(() => import("./pages/company/WhyTareeq"));
const Partners      = lazy(() => import("./pages/company/Partners"));
const Careers       = lazy(() => import("./pages/company/Careers"));
const PressKit      = lazy(() => import("./pages/company/PressKit"));
const Media         = lazy(() => import("./pages/company/Media"));

const HelpCenter     = lazy(() => import("./pages/help/HelpCenter"));
const FAQ            = lazy(() => import("./pages/help/FAQ"));
const Support        = lazy(() => import("./pages/help/Support"));
const ReportProblem  = lazy(() => import("./pages/help/ReportProblem"));
const ReportAbuse    = lazy(() => import("./pages/help/ReportAbuse"));
const SafetyTips     = lazy(() => import("./pages/help/SafetyTips"));
const BuyingGuide    = lazy(() => import("./pages/help/BuyingGuide"));
const SellingGuide   = lazy(() => import("./pages/help/SellingGuide"));
const FinancingGuide = lazy(() => import("./pages/help/FinancingGuide"));
const PostingGuide   = lazy(() => import("./pages/help/PostingGuide"));

const Dashboard         = lazy(() => import("./pages/user/Dashboard"));
const MyListings        = lazy(() => import("./pages/user/MyListings"));
const MyFinanceRequests = lazy(() => import("./pages/user/MyFinanceRequests"));
const Notifications     = lazy(() => import("./pages/user/Notifications"));
const Inbox             = lazy(() => import("./pages/user/Inbox"));
const Chat              = lazy(() => import("./pages/user/Chat"));
const AccountSettings   = lazy(() => import("./pages/user/AccountSettings"));
const SecuritySettings  = lazy(() => import("./pages/user/SecuritySettings"));
const DeleteAccount     = lazy(() => import("./pages/user/DeleteAccount"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const Featured = lazy(() => import("./pages/Featured"));
const Stats = lazy(() => import("./pages/Stats"));
const Exhibitions = lazy(() => import("./pages/Exhibitions"));
const ExhibitionSubscribe = lazy(() => import("./pages/ExhibitionSubscribe"));
const ExhibitionDetail = lazy(() => import("./pages/ExhibitionDetail"));
const Products = lazy(() => import("./pages/Products"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const PromoteListing   = lazy(() => import("./pages/user/PromoteListing"));
const UserProfile     = lazy(() => import("./pages/user/UserProfile"));
const BannerAds = lazy(() => import("./pages/BannerAds"));
const SendAdChat = lazy(() => import("./pages/SendAdChat"));
const ShiftCalculator = lazy(() => import("./pages/ShiftCalculator"));

const PageSpinner = () => (
  <div className="min-h-screen bg-bg flex items-center justify-center p-6">
    <div className="w-full max-w-md mx-auto">
      <PageSkeleton />
    </div>
  </div>
);

const InlineSpinner = () => (
  <div className="min-h-[50vh] flex items-center justify-center p-6">
    <div className="w-full max-w-sm mx-auto grid grid-cols-2 gap-4">
      <ListingCardSkeleton />
      <ListingCardSkeleton />
    </div>
  </div>
);

function SplashGate({ children }: { children: React.ReactNode }) {
  // في تطبيق الموبايل: شاشة البداية تظهر مع كل فتح (مش مرة واحدة في الجلسة)
  // على الويب: مرة واحدة فقط لكل جلسة تصفح
  const [splashDone, setSplashDone] = useState(() => {
    if (isNativeApp()) return false;
    try { return sessionStorage.getItem('tareeq_splash_seen') === '1'; } catch { return false; }
  });

  const finish = useCallback(() => {
    try { sessionStorage.setItem('tareeq_splash_seen', '1'); } catch { /* ignore */ }
    setSplashDone(true);
  }, []);

  if (!splashDone) return <SplashScreen onFinish={finish} />;
  return <>{children}</>;
}

function WithLayout({ children }: { children: React.ReactNode }) {
  useAndroidBackButton();
  const location = useLocation();
  const isV2Home = HOME_VERSION === 'v2' && location.pathname === '/';
  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:z-[10000] focus:bg-orange focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-bold">تخطي إلى المحتوى الرئيسي</a>
      <ScrollToTop />
      <PushStatusBanner />
      <InstallPrompt />
      {!isV2Home && <Header />}
      <main id="main-content">
        <Suspense fallback={<InlineSpinner />}>
          <ErrorBoundary>{children}</ErrorBoundary>
        </Suspense>
      </main>
      {!isV2Home && <Footer />}
      <BottomNav />
      <WhatsAppFloat />
      <AiAssistantChat />
    </>
  );
}

function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    trackEvent('page_view', { page_path: location.pathname + location.search });
    applyDemoParam();
  }, [location.pathname, location.search]);
  return null;
}

// استقبال رجوع فيسبوك بعد السماح: صفحة جيبه (code) → نبعته للسيرفر للاستبدال
// وإتمام الربط (settings/fbConn) → redirect للوحة بنتيجة العملية.
function FbOAuthCallback() {
  const location = useLocation();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('error') === 'access_denied') {
      const u = new URL(window.location.href);
      u.searchParams.delete('error');
      u.searchParams.delete('error_description');
      window.history.replaceState({}, '', u.toString());
      window.location.assign('/admin?fb=e');
      return;
    }
    if (!q.has('code')) return;

    const code = q.get('code') || '';
    const u = new URL(window.location.href);
    u.searchParams.delete('code');
    u.searchParams.delete('state');
    window.history.replaceState({}, '', u.toString());

    (async () => {
      let ok = false;
      try {
        const r = await fetch('/api/whatsapp-notify?action=fb-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const d = await r.json();
        ok = !!(d && d.success);
      } catch {}
      window.location.assign(ok ? '/admin?fb=ok' : '/admin?fb=fail');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);
  return null;
}

function App() {
  const { user, loading } = useAuth();

  const isAuth = !!user;

  return (
    <SplashGate>
      {loading ? <PageSpinner /> : (
    <BrowserRouter>
      <RouteTracker />
      <PushSetup />
      <FbOAuthCallback />
      <Routes>
        <Route path="/maintenance" element={<Suspense fallback={<PageSpinner />}><Maintenance /></Suspense>} />
        <Route path="/offline"     element={<Suspense fallback={<PageSpinner />}><Offline /></Suspense>} />
        <Route path="/coming-soon" element={<Suspense fallback={<PageSpinner />}><ComingSoon /></Suspense>} />
        <Route path="/admin"       element={
          <ProtectedRoute adminOnly>
            <Suspense fallback={<PageSpinner />}><AdminDashboard /></Suspense>
          </ProtectedRoute>
        } />

        <Route path="/" element={<WithLayout><Home /></WithLayout>} />
        <Route path="/join" element={<WithLayout><Join /></WithLayout>} />
        <Route path="/platform" element={<WithLayout><PlatformLanding /></WithLayout>} />
        <Route path="/vehicles"    element={<WithLayout><Vehicles /></WithLayout>} />
        <Route path="/search"      element={<WithLayout><Search /></WithLayout>} />
        <Route path="/equipment"   element={<WithLayout><Equipment /></WithLayout>} />
        <Route path="/loads"       element={<WithLayout><Loads /></WithLayout>} />
        <Route path="/jobs"        element={<WithLayout><Jobs /></WithLayout>} />
        <Route path="/services"    element={<WithLayout><Services /></WithLayout>} />
        <Route path="/spare-parts" element={<WithLayout><SpareParts /></WithLayout>} />
        <Route path="/finance"     element={<WithLayout><Finance /></WithLayout>} />
        <Route path="/emergency"   element={<WithLayout><Emergency /></WithLayout>} />
        <Route path="/listing/:id/:slug" element={<WithLayout><ListingDetail /></WithLayout>} />
        <Route path="/listing/:id" element={<WithLayout><ListingDetail /></WithLayout>} />
        <Route path="/ad/:id"      element={<AdRedirect />} />
        <Route path="/user/:id"    element={<WithLayout><UserProfile /></WithLayout>} />
        <Route path="/favorites"   element={<WithLayout><Favorites /></WithLayout>} />
        <Route path="/featured"    element={<WithLayout><Featured /></WithLayout>} />
        <Route path="/stats"       element={<WithLayout><Stats /></WithLayout>} />
        <Route path="/contact"     element={<WithLayout><Contact /></WithLayout>} />
        <Route path="/share-app"   element={<WithLayout><ShareApp /></WithLayout>} />
        <Route path="/exhibitions" element={<WithLayout><Exhibitions /></WithLayout>} />
        <Route path="/exhibitions/subscribe" element={<ProtectedRoute><WithLayout><ExhibitionSubscribe /></WithLayout></ProtectedRoute>} />
        <Route path="/exhibitions/:id/:slug" element={<WithLayout><ExhibitionDetail /></WithLayout>} />
        <Route path="/exhibitions/:id" element={<WithLayout><ExhibitionDetail /></WithLayout>} />
        <Route path="/products" element={<WithLayout><Products /></WithLayout>} />
        <Route path="/product/:id" element={<WithLayout><ProductDetail /></WithLayout>} />
        <Route path="/banner-ads"  element={<ProtectedRoute><WithLayout><BannerAds /></WithLayout></ProtectedRoute>} />
        <Route path="/send-ad" element={<Suspense fallback={<PageSpinner />}><SendAdChat /></Suspense>} />

        {/* Legal */}
        <Route path="/privacy-policy"          element={<WithLayout><PrivacyPolicy /></WithLayout>} />
        <Route path="/terms"                   element={<WithLayout><TermsConditions /></WithLayout>} />
        <Route path="/cookies"                 element={<WithLayout><CookiePolicy /></WithLayout>} />
        <Route path="/content-policy"          element={<WithLayout><ContentPolicy /></WithLayout>} />
        <Route path="/acceptable-use"          element={<WithLayout><AcceptableUsePolicy /></WithLayout>} />
        <Route path="/fraud-prevention"        element={<WithLayout><FraudPreventionPolicy /></WithLayout>} />
        <Route path="/finance-policy"          element={<WithLayout><FinancePolicy /></WithLayout>} />
        <Route path="/vehicle-listing-policy"  element={<WithLayout><VehicleListingPolicy /></WithLayout>} />
        <Route path="/marketplace-policy"      element={<WithLayout><MarketplacePolicy /></WithLayout>} />
        <Route path="/user-safety"             element={<WithLayout><UserSafetyPolicy /></WithLayout>} />
        <Route path="/data-protection"         element={<WithLayout><DataProtectionPolicy /></WithLayout>} />
        <Route path="/account-deletion-policy" element={<WithLayout><AccountDeletionPolicy /></WithLayout>} />
        <Route path="/refund-policy"           element={<WithLayout><RefundPolicy /></WithLayout>} />
        <Route path="/community-guidelines"    element={<WithLayout><CommunityGuidelines /></WithLayout>} />
        <Route path="/copyright-policy"        element={<WithLayout><CopyrightPolicy /></WithLayout>} />

        {/* Company */}
        <Route path="/about"       element={<WithLayout><AboutUs /></WithLayout>} />
        <Route path="/mission"     element={<WithLayout><MissionVision /></WithLayout>} />
        <Route path="/why-carmasr" element={<WithLayout><WhyTareeq /></WithLayout>} />
        <Route path="/partners"    element={<WithLayout><Partners /></WithLayout>} />
        <Route path="/careers"     element={<WithLayout><Careers /></WithLayout>} />
        <Route path="/press"       element={<WithLayout><PressKit /></WithLayout>} />
        <Route path="/media"       element={<WithLayout><Media /></WithLayout>} />

        {/* Help */}
        <Route path="/help"                 element={<WithLayout><HelpCenter /></WithLayout>} />
        <Route path="/faq"                  element={<WithLayout><FAQ /></WithLayout>} />
        <Route path="/support"              element={<WithLayout><Support /></WithLayout>} />
        <Route path="/report-problem"       element={<WithLayout><ReportProblem /></WithLayout>} />
        <Route path="/report-abuse"         element={<WithLayout><ReportAbuse /></WithLayout>} />
        <Route path="/safety-tips"          element={<WithLayout><SafetyTips /></WithLayout>} />
        <Route path="/help/buying-guide"    element={<WithLayout><BuyingGuide /></WithLayout>} />
        <Route path="/help/selling-guide"   element={<WithLayout><SellingGuide /></WithLayout>} />
        <Route path="/help/financing-guide" element={<WithLayout><FinancingGuide /></WithLayout>} />
        <Route path="/help/posting-guide"   element={<WithLayout><PostingGuide /></WithLayout>} />

        <Route path="/login"    element={isAuth ? <Navigate to="/" replace /> : <WithLayout><Login /></WithLayout>} />
        <Route path="/register" element={isAuth ? <Navigate to="/" replace /> : <WithLayout><Register /></WithLayout>} />
        <Route path="/complete-profile" element={<ProtectedRoute><WithLayout><CompleteProfile /></WithLayout></ProtectedRoute>} />

        <Route path="/profile"           element={<ProtectedRoute><WithLayout><Profile /></WithLayout></ProtectedRoute>} />
        <Route path="/post-listing"      element={<ProtectedRoute><WithLayout><PostListing /></WithLayout></ProtectedRoute>} />
        <Route path="/listing/:id/edit"  element={<ProtectedRoute><WithLayout><EditListing /></WithLayout></ProtectedRoute>} />
        <Route path="/load/:id"          element={<WithLayout><LoadDetail /></WithLayout>} />
        <Route path="/load/:id/edit"     element={<ProtectedRoute><WithLayout><EditLoad /></WithLayout></ProtectedRoute>} />
        <Route path="/dashboard"         element={<ProtectedRoute><WithLayout><Dashboard /></WithLayout></ProtectedRoute>} />
        <Route path="/my-listings"       element={<ProtectedRoute><WithLayout><MyListings /></WithLayout></ProtectedRoute>} />
        <Route path="/my-finance"        element={<ProtectedRoute><WithLayout><MyFinanceRequests /></WithLayout></ProtectedRoute>} />
        <Route path="/shift-calculator"  element={<ProtectedRoute><WithLayout><ShiftCalculator /></WithLayout></ProtectedRoute>} />
        <Route path="/notifications"     element={<ProtectedRoute><WithLayout><Notifications /></WithLayout></ProtectedRoute>} />
        <Route path="/promote/:id"       element={<ProtectedRoute><WithLayout><PromoteListing /></WithLayout></ProtectedRoute>} />
        <Route path="/inbox"             element={<ProtectedRoute><WithLayout><Inbox /></WithLayout></ProtectedRoute>} />
        <Route path="/inbox/:userId"     element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/settings"          element={<ProtectedRoute><WithLayout><AccountSettings /></WithLayout></ProtectedRoute>} />
        <Route path="/security-settings" element={<ProtectedRoute><WithLayout><SecuritySettings /></WithLayout></ProtectedRoute>} />
        <Route path="/delete-account"    element={<WithLayout><DeleteAccount /></WithLayout>} />

        <Route path="/make-admin" element={<WithLayout><MakeAdmin /></WithLayout>} />
        <Route path="/500"        element={<WithLayout><ServerError /></WithLayout>} />
        <Route path="*"           element={<WithLayout><NotFound404 /></WithLayout>} />
      </Routes>
    </BrowserRouter>
      )}
    </SplashGate>
  );
}

export default App;

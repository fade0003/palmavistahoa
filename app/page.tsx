import HeroBanner from "./components/HeroBanner";
import PaymentRibbon from "./components/PaymentRibbon";
import Announcements from "./components/Announcements";
import DocumentGrid from "./components/DocumentGrid";
import FAQSection from "./components/FAQSection";
import Gallery from "./components/Gallery";
import ContactSection from "./components/ContactSection";
import Footer from "./components/Footer";
import ChatBot from "./components/ChatBot";

export default function Home() {
  return (
    <main className="min-h-screen">
      <HeroBanner />
      <PaymentRibbon />
      <Announcements />
      <DocumentGrid />
      <FAQSection />
      <Gallery />
      <ContactSection />
      <Footer />
      <ChatBot />
    </main>
  );
}

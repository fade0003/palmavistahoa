import HeroBanner from "./components/HeroBanner";
import PaymentRibbon from "./components/PaymentRibbon";
import DocumentGrid from "./components/DocumentGrid";
import ContactSection from "./components/ContactSection";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen">
      <HeroBanner />
      <PaymentRibbon />
      <DocumentGrid />
      <ContactSection />
      <Footer />
    </main>
  );
}

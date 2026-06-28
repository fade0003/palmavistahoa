import HeroBanner from "./components/HeroBanner";
import PaymentRibbon from "./components/PaymentRibbon";
import DocumentGrid from "./components/DocumentGrid";
import Footer from "./components/Footer";
import ChatBot from "./components/ChatBot";

export default function Home() {
  return (
    <main className="min-h-screen">
      <HeroBanner />
      <PaymentRibbon />
      <DocumentGrid />
      <Footer />
      <ChatBot />
    </main>
  );
}

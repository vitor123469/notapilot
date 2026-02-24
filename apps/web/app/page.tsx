import { LandingNav } from "../src/components/landing/LandingNav";
import { HeroSection } from "../src/components/landing/HeroSection";
import { WhySection } from "../src/components/landing/WhySection";
import { HowSection } from "../src/components/landing/HowSection";
import { FeaturesSection } from "../src/components/landing/FeaturesSection";
import { WhoSection } from "../src/components/landing/WhoSection";
import { TrustSection } from "../src/components/landing/TrustSection";
import { FAQSection } from "../src/components/landing/FAQSection";
import { CTASection } from "../src/components/landing/CTASection";
import { LandingFooter } from "../src/components/landing/LandingFooter";

export default function Home() {
  return (
    <>
      <LandingNav />
      <main>
        <HeroSection />
        <WhySection />
        <HowSection />
        <FeaturesSection />
        <WhoSection />
        <TrustSection />
        <FAQSection />
        <CTASection />
      </main>
      <LandingFooter />
    </>
  );
}

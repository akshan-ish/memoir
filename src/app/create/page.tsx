import { LandingTheme } from "@/components/landing-theme";
import { MemoirCreator } from "@/components/memoir-creator";
import { loadSiteTitle } from "@/lib/load-trips";

export const metadata = {
  title: "Make a memoir",
  description: "Turn a folder of photos into a quiet photo book — all in your browser.",
};

export default function CreatePage() {
  return (
    <>
      <LandingTheme siteTitle={loadSiteTitle()} />
      <MemoirCreator />
    </>
  );
}

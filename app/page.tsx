import { AtlasApp } from "@/components/atlas-app";
import { baseDemoResult, demoInput } from "@/lib/demo";

export default function Home() {
  return <AtlasApp initialResult={baseDemoResult(demoInput)} />;
}

"use client";

import { NomadStudioView } from "./components/NomadStudioView";
import { useNomadStudio } from "./useNomadStudio";

export default function NomadStudioPage() {
  const { granted, overview, loading, error, showTechnical, setShowTechnical, reload, connectGoogle } = useNomadStudio();

  if (!granted) return null;

  return <NomadStudioView overview={overview} loading={loading} error={error} showTechnical={showTechnical} onToggleTechnical={setShowTechnical} onReload={reload} onConnectGoogle={connectGoogle} />;
}

import { useState } from "react";
import { PointsDetailPage } from "@/app/components/points-detail-page";
import { EcoboardDashboard } from "@/app/components/ecoboard-dashboard";

export default function App() {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="size-full">
      {showDetails ? (
        <PointsDetailPage onBack={() => setShowDetails(false)} />
      ) : (
        <EcoboardDashboard onViewPointsDetails={() => setShowDetails(true)} />
      )}
    </div>
  );
}
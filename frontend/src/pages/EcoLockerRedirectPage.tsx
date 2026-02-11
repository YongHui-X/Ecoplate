import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getEcoLockerHomeUrl } from "../services/capacitor";

/**
 * EcoLocker Redirect Page
 * Redirects to the EcoLocker app with the user's token
 */
export default function EcoLockerRedirectPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      window.location.href = getEcoLockerHomeUrl(token);
    } else {
      // If no token, redirect to login
      navigate("/login");
    }
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirecting to EcoLocker...</p>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { cn } from "../lib/utils";

// Predefined avatar options
const AVATAR_OPTIONS = [
  { id: "avatar1", emoji: "🌱", label: "Sprout" },
  { id: "avatar2", emoji: "🌿", label: "Herb" },
  { id: "avatar3", emoji: "🍃", label: "Leaf" },
  { id: "avatar4", emoji: "🌾", label: "Grain" },
  { id: "avatar5", emoji: "🥬", label: "Veggie" },
  { id: "avatar6", emoji: "🥕", label: "Carrot" },
  { id: "avatar7", emoji: "🍎", label: "Apple" },
  { id: "avatar8", emoji: "🥑", label: "Avocado" },
];

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [userLocation, setUserLocation] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0].id);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      addToast("Passwords do not match", "error");
      return;
    }

    if (password.length < 8) {
      addToast("Password must be at least 8 characters", "error");
      return;
    }

    setLoading(true);

    try {
      await register(email, password, name, userLocation || undefined, selectedAvatar);
      addToast("Welcome to EcoPlate!", "success");
      navigate("/");
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Registration failed",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">EcoPlate</CardTitle>
          <CardDescription>Create your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userLocation">Location (Optional)</Label>
              <Input
                id="userLocation"
                type="text"
                placeholder="e.g., Singapore 119076"
                value={userLocation}
                onChange={(e) => setUserLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Choose Your Avatar</Label>
              <div className="grid grid-cols-4 gap-2">
                {AVATAR_OPTIONS.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => setSelectedAvatar(avatar.id)}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all hover:scale-105",
                      selectedAvatar === avatar.id
                        ? "border-primary bg-primary/10"
                        : "border-gray-200 hover:border-primary/50"
                    )}
                  >
                    <span className="text-2xl mb-1">{avatar.emoji}</span>
                    <span className="text-xs text-gray-600">{avatar.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

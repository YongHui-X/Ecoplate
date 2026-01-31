import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { cn } from "../lib/utils";
import { User, MapPin, Mail } from "lucide-react";

// Predefined avatar options (same as RegisterPage)
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

export default function AccountPage() {
  const { user, updateProfile } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState(user?.name || "");
  const [userLocation, setUserLocation] = useState(user?.userLocation || "");
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatarUrl || AVATAR_OPTIONS[0].id);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setUserLocation(user.userLocation || "");
      setSelectedAvatar(user.avatarUrl || AVATAR_OPTIONS[0].id);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateProfile({
        name,
        userLocation: userLocation || null,
        avatarUrl: selectedAvatar,
      });
      addToast("Profile updated successfully!", "success");
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Failed to update profile",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const getAvatarEmoji = (avatarId: string) => {
    const avatar = AVATAR_OPTIONS.find(a => a.id === avatarId);
    return avatar?.emoji || AVATAR_OPTIONS[0].emoji;
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-500 mt-1">Manage your profile and preferences</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your current avatar</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center text-6xl mb-4">
              {getAvatarEmoji(selectedAvatar)}
            </div>
            <h3 className="font-semibold text-lg">{user.name}</h3>
            <p className="text-sm text-gray-500">{user.email}</p>
          </CardContent>
        </Card>

        {/* Edit Form */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
            <CardDescription>Update your profile information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={user.email}
                    className="pl-10 bg-gray-50"
                    disabled
                  />
                </div>
                <p className="text-xs text-gray-500">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="userLocation">Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="userLocation"
                    type="text"
                    placeholder="e.g., Singapore 119076"
                    value={userLocation}
                    onChange={(e) => setUserLocation(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Choose Your Avatar</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

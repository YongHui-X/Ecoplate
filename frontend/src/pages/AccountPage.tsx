import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { cn } from "../lib/utils";
import { User, MapPin, Mail, Bell, Clock, Award, Flame, AlertCircle, Trophy, LogOut, ChevronRight, Gift, Package } from "lucide-react";
import { notificationService, NotificationPreferences } from "../services/notifications";
import { useLockerUnread } from "../features/ecolocker/contexts/LockerUnreadContext";

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
  const { user, updateProfile, logout } = useAuth();
  const { addToast } = useToast();
  const { lockerUnreadCount } = useLockerUnread();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  const [name, setName] = useState(user?.name || "");
  const [userLocation, setUserLocation] = useState(user?.userLocation || "");
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatarUrl || AVATAR_OPTIONS[0].id);

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({
    expiringProducts: true,
    badgeUnlocked: true,
    streakMilestone: true,
    productStale: true,
    staleDaysThreshold: 7,
    expiryDaysThreshold: 3,
  });

  useEffect(() => {
    if (user) {
      setName(user.name);
      setUserLocation(user.userLocation || "");
      setSelectedAvatar(user.avatarUrl || AVATAR_OPTIONS[0].id);
    }
  }, [user]);

  // Fetch notification preferences
  useEffect(() => {
    async function fetchPrefs() {
      try {
        const { preferences } = await notificationService.getPreferences();
        setNotifPrefs(preferences);
      } catch {
        // Silently fail - use defaults
      }
    }
    fetchPrefs();
  }, []);

  const handleNotifToggle = async (key: keyof NotificationPreferences, value: boolean) => {
    setNotifLoading(true);
    try {
      const { preferences } = await notificationService.updatePreferences({ [key]: value });
      setNotifPrefs(preferences);
    } catch (error) {
      addToast("Failed to update notification settings", "error");
    } finally {
      setNotifLoading(false);
    }
  };

  const handleThresholdChange = async (key: "staleDaysThreshold" | "expiryDaysThreshold", value: number) => {
    if (value < 1 || value > 30) return;
    setNotifLoading(true);
    try {
      const { preferences } = await notificationService.updatePreferences({ [key]: value });
      setNotifPrefs(preferences);
    } catch (error) {
      addToast("Failed to update notification settings", "error");
    } finally {
      setNotifLoading(false);
    }
  };

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

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const mobileNavItems = [
    { to: "/ecolocker", icon: Package, label: "EcoLocker", description: "Locker delivery service", color: "bg-primary/10 text-primary" },
    { to: "/ecopoints", icon: Trophy, label: "EcoPoints", description: "View your eco impact", color: "bg-primary/10 text-primary" },
    { to: "/badges", icon: Award, label: "Badges", description: "Achievements & milestones", color: "bg-accent/10 text-accent" },
    { to: "/rewards", icon: Gift, label: "Rewards", description: "Redeem your points", color: "bg-success/10 text-success" },
    { to: "/notifications", icon: Bell, label: "Notifications", description: "Alerts & updates", color: "bg-warning/10 text-warning" },
  ];

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Account Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile and preferences</p>
      </div>

      {/* Mobile navigation hub - only visible on mobile */}
      <div className="lg:hidden space-y-3">
        {/* Compact profile card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
                {getAvatarEmoji(selectedAvatar)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">{user.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation menu */}
        <Card>
          <CardContent className="p-2">
            {mobileNavItems.map((item, index) => (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className={cn(
                  "flex items-center gap-3 w-full p-3 rounded-xl text-left transition-colors hover:bg-muted",
                  index < mobileNavItems.length - 1 && "mb-1"
                )}
              >
                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", item.color)}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                {item.to === "/ecolocker" && lockerUnreadCount > 0 && (
                  <span className="bg-destructive text-destructive-foreground text-xs font-bold h-5 min-w-[20px] flex items-center justify-center rounded-full px-1.5">
                    {lockerUnreadCount > 99 ? "99+" : lockerUnreadCount}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </CardContent>
        </Card>

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
            <p className="text-sm text-muted-foreground">{user.email}</p>
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
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
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
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={user.email}
                    className="pl-10 bg-muted"
                    disabled
                  />
                </div>
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="userLocation">Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
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
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <span className="text-2xl mb-1">{avatar.emoji}</span>
                      <span className="text-xs text-muted-foreground">{avatar.label}</span>
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

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>Choose which notifications you want to receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle switches */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="font-medium">Expiring Products</p>
                  <p className="text-sm text-muted-foreground">Get notified when products are expiring soon</p>
                </div>
              </div>
              <button
                onClick={() => handleNotifToggle("expiringProducts", !notifPrefs.expiringProducts)}
                disabled={notifLoading}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  notifPrefs.expiringProducts ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    notifPrefs.expiringProducts ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                  <Award className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="font-medium">Badge Unlocked</p>
                  <p className="text-sm text-muted-foreground">Get notified when you earn a new badge</p>
                </div>
              </div>
              <button
                onClick={() => handleNotifToggle("badgeUnlocked", !notifPrefs.badgeUnlocked)}
                disabled={notifLoading}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  notifPrefs.badgeUnlocked ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    notifPrefs.badgeUnlocked ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Flame className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Streak Milestones</p>
                  <p className="text-sm text-muted-foreground">Get notified when you hit streak milestones</p>
                </div>
              </div>
              <button
                onClick={() => handleNotifToggle("streakMilestone", !notifPrefs.streakMilestone)}
                disabled={notifLoading}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  notifPrefs.streakMilestone ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    notifPrefs.streakMilestone ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Stale Products</p>
                  <p className="text-sm text-muted-foreground">Get notified about products sitting too long</p>
                </div>
              </div>
              <button
                onClick={() => handleNotifToggle("productStale", !notifPrefs.productStale)}
                disabled={notifLoading}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  notifPrefs.productStale ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    notifPrefs.productStale ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
          </div>

          {/* Threshold settings */}
          <div className="border-t pt-6 space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Thresholds</h4>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Expiry Warning</p>
                <p className="text-sm text-muted-foreground">Days before expiry to notify</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleThresholdChange("expiryDaysThreshold", notifPrefs.expiryDaysThreshold - 1)}
                  disabled={notifLoading || notifPrefs.expiryDaysThreshold <= 1}
                >
                  -
                </Button>
                <span className="w-8 text-center font-medium">{notifPrefs.expiryDaysThreshold}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleThresholdChange("expiryDaysThreshold", notifPrefs.expiryDaysThreshold + 1)}
                  disabled={notifLoading || notifPrefs.expiryDaysThreshold >= 30}
                >
                  +
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Stale Product Warning</p>
                <p className="text-sm text-muted-foreground">Days before marking as stale</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleThresholdChange("staleDaysThreshold", notifPrefs.staleDaysThreshold - 1)}
                  disabled={notifLoading || notifPrefs.staleDaysThreshold <= 1}
                >
                  -
                </Button>
                <span className="w-8 text-center font-medium">{notifPrefs.staleDaysThreshold}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleThresholdChange("staleDaysThreshold", notifPrefs.staleDaysThreshold + 1)}
                  disabled={notifLoading || notifPrefs.staleDaysThreshold >= 30}
                >
                  +
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logout button - mobile only, at the very bottom */}
      <button
        onClick={handleLogout}
        className="lg:hidden flex items-center gap-3 w-full p-4 rounded-2xl border border-destructive/20 bg-destructive/5 text-destructive transition-colors hover:bg-destructive/10"
      >
        <LogOut className="h-5 w-5" />
        <span className="font-medium">Log Out</span>
      </button>
    </div>
  );
}

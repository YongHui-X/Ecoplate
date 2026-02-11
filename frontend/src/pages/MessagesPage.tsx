import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { messageService, Conversation, ConversationTab } from "../services/messages";
import { uploadService } from "../services/upload";
import { useAuth } from "../contexts/AuthContext";
import { useUnreadCount } from "../contexts/UnreadCountContext";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { MessageCircle, ShoppingBag, Store, Archive, Package } from "lucide-react";
import { formatRelativeTime } from "../utils/dateFormatting";

const tabs: { id: ConversationTab; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "All", icon: MessageCircle },
  { id: "buying", label: "Buying", icon: ShoppingBag },
  { id: "selling", label: "Selling", icon: Store },
  { id: "archived", label: "Archived", icon: Archive },
];

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ConversationTab>("all");
  const [, setCurrentTime] = useState(Date.now());
  const { user } = useAuth();
  const { refreshUnreadCount } = useUnreadCount();

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 5000);
    const timeInterval = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
    };
  }, []);

  const loadConversations = async () => {
    try {
      const data = await messageService.getConversations();
      setConversations(data);
      await refreshUnreadCount();
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      const isArchived = conv.listing.status === "completed";

      switch (activeTab) {
        case "buying":
          return conv.role === "buying" && !isArchived;
        case "selling":
          return conv.role === "selling" && !isArchived;
        case "archived":
          return isArchived;
        case "all":
        default:
          return !isArchived;
      }
    });
  }, [conversations, activeTab]);

  const tabCounts = useMemo(() => {
    const counts = { all: 0, buying: 0, selling: 0, archived: 0 };
    conversations.forEach((conv) => {
      const isArchived = conv.listing.status === "completed";
      if (isArchived) {
        counts.archived++;
      } else {
        counts.all++;
        if (conv.role === "buying") counts.buying++;
        if (conv.role === "selling") counts.selling++;
      }
    });
    return counts;
  }, [conversations]);


  const totalUnread = conversations
    .filter((c) => c.listing.status !== "completed")
    .reduce((sum, c) => sum + c.unreadCount, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-card rounded-2xl">
              <Skeleton className="h-16 w-16 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Messages</h1>
          <p className="text-muted-foreground mt-1">Your marketplace conversations</p>
        </div>
        {totalUnread > 0 && (
          <Badge variant="destructive" className="text-sm px-3 py-1.5">
            {totalUnread} unread
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-1 sm:px-1 touch-pan-x scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const count = tabCounts[tab.id];
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap px-2 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <Icon className="hidden sm:block h-4 w-4 flex-shrink-0" />
              {tab.label}
              {count > 0 && (
                <span className={`hidden sm:flex ml-1 h-5 min-w-[20px] items-center justify-center text-xs font-bold rounded-full px-1.5 ${
                  isActive ? "bg-primary-foreground/20" : "bg-foreground/10"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Conversation List */}
      {filteredConversations.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <MessageCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">
              {activeTab === "archived"
                ? "No archived conversations"
                : activeTab === "buying"
                ? "No buying conversations"
                : activeTab === "selling"
                ? "No selling conversations"
                : "No conversations yet"}
            </p>
            {activeTab === "all" && (
              <p className="text-sm text-muted-foreground mt-2">
                Start a conversation by messaging a seller on a listing
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredConversations.map((conv) => (
            <ConversationCard
              key={conv.id}
              conversation={conv}
              currentUserId={user?.id ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ConversationCardProps {
  conversation: Conversation;
  currentUserId: number;
}

function ConversationCard({ conversation, currentUserId }: ConversationCardProps) {
  const otherUser =
    conversation.seller.id === currentUserId
      ? conversation.buyer
      : conversation.seller;

  const lastMessageTime = conversation.lastMessage
    ? conversation.lastMessage.createdAt
    : conversation.updatedAt;

  const isArchived = conversation.listing.status === "completed";
  const isSelling = conversation.role === "selling";

  // Get first image as thumbnail
  const imageUrls = uploadService.getListingImageUrls(conversation.listing.images);
  const thumbnailUrl = imageUrls[0];

  return (
    <Link
      to={`/messages/${conversation.id}`}
      className="block"
    >
      <Card
        className={`card-hover press-effect transition-all ${
          conversation.unreadCount > 0 && !isArchived
            ? "border-primary/50 bg-primary/5"
            : isArchived
            ? "opacity-60"
            : ""
        }`}
      >
        <CardContent className="p-4">
          <div className="flex gap-4">
            {/* Product Thumbnail */}
            <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0">
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={conversation.listing.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              {isArchived && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold">SOLD</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Role Badge */}
                  <Badge
                    variant={isSelling ? "default" : "secondary"}
                    className="text-[10px] shrink-0 px-2 py-0.5"
                  >
                    {isSelling ? (
                      <>
                        <Store className="h-3 w-3 mr-1" />
                        Selling
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="h-3 w-3 mr-1" />
                        Buying
                      </>
                    )}
                  </Badge>
                  <p
                    className={`truncate text-sm text-foreground ${
                      conversation.unreadCount > 0 ? "font-bold" : "font-medium"
                    }`}
                  >
                    {otherUser.name}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {conversation.unreadCount > 0 && !isArchived && (
                    <div className="w-5 h-5 bg-destructive rounded-full flex items-center justify-center text-destructive-foreground text-xs font-bold">
                      {conversation.unreadCount}
                    </div>
                  )}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatRelativeTime(lastMessageTime)}
                  </span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground truncate mt-1">
                {conversation.listing.title}
                {conversation.listing.price !== null && (
                  <span className="ml-2 font-semibold text-foreground">
                    {conversation.listing.price === 0
                      ? "Free"
                      : `$${conversation.listing.price.toFixed(2)}`}
                  </span>
                )}
              </p>

              {conversation.lastMessage && (
                <p
                  className={`text-sm truncate mt-1 ${
                    conversation.unreadCount > 0
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {conversation.lastMessage.messageText}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

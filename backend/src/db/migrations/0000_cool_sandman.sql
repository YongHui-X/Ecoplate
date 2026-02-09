CREATE TABLE `product_sustainability_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer,
	`user_id` integer NOT NULL,
	`today_date` text NOT NULL,
	`quantity` real,
	`type` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `badges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text,
	`points_awarded` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`badge_image_url` text
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`seller_id` integer NOT NULL,
	`buyer_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `marketplace_listings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `listing_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`image_url` text NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `marketplace_listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `locker_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`order_id` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `locker_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `locker_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`locker_id` integer NOT NULL,
	`buyer_id` integer NOT NULL,
	`seller_id` integer NOT NULL,
	`item_price` real NOT NULL,
	`delivery_fee` real DEFAULT 2 NOT NULL,
	`total_price` real NOT NULL,
	`status` text DEFAULT 'pending_payment' NOT NULL,
	`reserved_at` integer,
	`payment_deadline` integer,
	`paid_at` integer,
	`pickup_scheduled_at` integer,
	`rider_picked_up_at` integer,
	`delivered_at` integer,
	`picked_up_at` integer,
	`expires_at` integer,
	`pickup_pin` text,
	`compartment_number` integer,
	`cancel_reason` text,
	FOREIGN KEY (`listing_id`) REFERENCES `marketplace_listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`locker_id`) REFERENCES `lockers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lockers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`coordinates` text NOT NULL,
	`total_compartments` integer DEFAULT 12 NOT NULL,
	`available_compartments` integer DEFAULT 12 NOT NULL,
	`operating_hours` text,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `marketplace_listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`seller_id` integer NOT NULL,
	`buyer_id` integer,
	`product_id` integer,
	`title` text NOT NULL,
	`description` text,
	`category` text,
	`quantity` real NOT NULL,
	`unit` text,
	`price` real,
	`original_price` real,
	`expiry_date` integer,
	`pickup_location` text,
	`images` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	`co2_saved` real,
	FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`message_text` text NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`expiring_products` integer DEFAULT true NOT NULL,
	`badge_unlocked` integer DEFAULT true NOT NULL,
	`streak_milestone` integer DEFAULT true NOT NULL,
	`product_stale` integer DEFAULT true NOT NULL,
	`stale_days_threshold` integer DEFAULT 7 NOT NULL,
	`expiry_days_threshold` integer DEFAULT 3 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`related_id` integer,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`read_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pending_consumption_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`raw_photo` text NOT NULL,
	`ingredients` text NOT NULL,
	`status` text DEFAULT 'PENDING_WASTE_PHOTO' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`product_name` text NOT NULL,
	`category` text,
	`quantity` real NOT NULL,
	`unit` text,
	`unit_price` real,
	`purchase_date` integer,
	`description` text,
	`co2_emission` real,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_badges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`badge_id` integer NOT NULL,
	`earned_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`badge_id`) REFERENCES `badges`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_points` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`total_points` integer DEFAULT 0 NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`total_co2_saved` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text,
	`user_location` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `badges_code_unique` ON `badges` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `notification_preferences_user_id_unique` ON `notification_preferences` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_badge_unique_idx` ON `user_badges` (`user_id`,`badge_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_points_user_id_unique` ON `user_points` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
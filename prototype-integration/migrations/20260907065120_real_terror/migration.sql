CREATE TABLE `conversations` (
	`workspace` text PRIMARY KEY,
	`snapshot` text NOT NULL,
	`history` text NOT NULL
);

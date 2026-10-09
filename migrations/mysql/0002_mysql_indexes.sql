-- fleets 0002: mysql_indexes
-- 0001 skipped the indexes on MySQL, so a table it created fresh has none.
-- MySQL has no CREATE INDEX IF NOT EXISTS, so each table is rebuilt with its
-- indexes and the rows copied over, dropping duplicates on the way.

DROP TABLE IF EXISTS `p_fleets_members_rebuild`;
DROP TABLE IF EXISTS `p_fleets_members_old`;
CREATE TABLE `p_fleets_members_rebuild` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `fleet_id` int NOT NULL,
  `host_id` int NOT NULL,
  `added_at` text NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (`fleet_id`) REFERENCES `p_fleets_fleets` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`host_id`) REFERENCES `ssh_data` (`id`) ON DELETE CASCADE
);
CREATE UNIQUE INDEX `idx_fleet_members_fleet_host` ON `p_fleets_members_rebuild` (`fleet_id`, `host_id`);
CREATE INDEX `idx_fleet_members_host` ON `p_fleets_members_rebuild` (`host_id`);
-- Keep the first membership row of each fleet and host pair.
INSERT INTO `p_fleets_members_rebuild` (`id`, `fleet_id`, `host_id`, `added_at`)
SELECT m.`id`, m.`fleet_id`, m.`host_id`, m.`added_at`
FROM `p_fleets_members` m
JOIN (
  SELECT MIN(`id`) AS `id` FROM `p_fleets_members` GROUP BY `fleet_id`, `host_id`
) keep ON keep.`id` = m.`id`;
RENAME TABLE `p_fleets_members` TO `p_fleets_members_old`, `p_fleets_members_rebuild` TO `p_fleets_members`;
DROP TABLE `p_fleets_members_old`;

DROP TABLE IF EXISTS `p_fleets_inventory_rebuild`;
DROP TABLE IF EXISTS `p_fleets_inventory_old`;
CREATE TABLE `p_fleets_inventory_rebuild` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `host_id` int NOT NULL,
  `user_id` varchar(255) NOT NULL,
  `os_pretty_name` text,
  `kernel` text,
  `architecture` text,
  `hostname` text,
  `uptime_seconds` int,
  `ip` text,
  `package_manager` text,
  `collected_at` text NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (`host_id`) REFERENCES `ssh_data` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
CREATE UNIQUE INDEX `idx_fleet_inventory_host` ON `p_fleets_inventory_rebuild` (`host_id`, `user_id`);
CREATE INDEX `idx_fleet_inventory_user` ON `p_fleets_inventory_rebuild` (`user_id`);
-- Keep the newest snapshot of each host and user pair.
INSERT INTO `p_fleets_inventory_rebuild` (`id`, `host_id`, `user_id`, `os_pretty_name`, `kernel`, `architecture`, `hostname`, `uptime_seconds`, `ip`, `package_manager`, `collected_at`)
SELECT i.`id`, i.`host_id`, i.`user_id`, i.`os_pretty_name`, i.`kernel`, i.`architecture`, i.`hostname`, i.`uptime_seconds`, i.`ip`, i.`package_manager`, i.`collected_at`
FROM `p_fleets_inventory` i
JOIN (
  SELECT MAX(`id`) AS `id` FROM `p_fleets_inventory` GROUP BY `host_id`, `user_id`
) keep ON keep.`id` = i.`id`;
RENAME TABLE `p_fleets_inventory` TO `p_fleets_inventory_old`, `p_fleets_inventory_rebuild` TO `p_fleets_inventory`;
DROP TABLE `p_fleets_inventory_old`;

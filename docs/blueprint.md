# Personal Crypto Watcher — Bot specification

**Archetype:** custom

**Voice:** professional and warm — write every user-facing message, button label, error, and empty state in this voice.

A private Telegram bot that lets users track crypto price alerts with customizable thresholds, percent changes, and quiet hours. Features include inline watchlist management, /price checks, morning summaries, and owner analytics for usage metrics.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- individual crypto traders
- crypto hobbyists
- Telegram power users

## Success criteria

- Users can add/remove/edit crypto tickers in watchlists
- Price alerts trigger with precise thresholds/percent changes
- Owner can view analytics dashboard with /owner_stats
- Alerts respect quiet hours and cooldown rules

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Initialize bot and show onboarding menu
- **/price** (command, actor: user, command: /price) — Check price of specific ticker or entire watchlist
  - inputs: ticker symbol
  - outputs: current price, 24h change
- **/list** (command, actor: user, command: /list) — Show watchlist with edit/remove buttons
- **/settings** (command, actor: user, command: /settings) — Configure quiet hours, cooldowns, and timezone
- **/summary** (command, actor: user, command: /summary) — Toggle morning summary settings
- **/owner_stats** (command, actor: owner, command: /owner_stats) — Show analytics dashboard

## Flows

### Onboarding
_Trigger:_ /start

1. Display welcome message
2. Show quick-add buttons for BTC/ETH/TON
3. Prompt for quiet hours and morning summary setup

_Data touched:_ user profile

### Watchlist Management
_Trigger:_ Inline button or /list

1. Display current watchlist
2. Show edit/remove buttons per item
3. Handle quick-add buttons for common coins

_Data touched:_ watchlist items

### Price Alert Trigger
_Trigger:_ Market price update

1. Check all user watchlists
2. Calculate threshold/percent changes
3. Send alert if conditions met and cooldown expired

_Data touched:_ alert events, watchlist items

### Morning Summary
_Trigger:_ Scheduled daily at user's local time

1. Aggregate alerts from previous day
2. Include queued alerts from quiet hours
3. Show prices and major changes

_Data touched:_ alert events, user profile

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **user_profile** _(retention: persistent)_ — User-specific settings and preferences
  - fields: telegram_id, display_name, timezone, language, quiet_hours_start, quiet_hours_end, summary_time, cooldown_duration
- **watchlist_item** _(retention: persistent)_ — Monitored crypto ticker with alert rules
  - fields: ticker_symbol, display_name, last_known_price, threshold_alert_enabled, threshold_value, threshold_direction, percent_alert_enabled, percent_value, interval, last_alert_timestamp, cooldown_state
- **alert_event** _(retention: persistent)_ — Record of triggered alerts for analytics
  - fields: user_id, ticker, alert_type, old_price, new_price, percent_change, timestamp
- **owner_analytics** _(retention: persistent)_ — Aggregated usage metrics
  - fields: total_users, active_users_30d, top_alerts_by_ticker, alert_type_counts

## Integrations

- **Telegram** (required) — Primary messaging interface
- **Market Price Feed** (required) — Real-time crypto price data
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- /owner_stats command to view analytics dashboard

## Notifications

- Price threshold alerts
- Percent change alerts
- Morning summary digest
- Quiet hours alert queue delivery

## Permissions & privacy

- All user data stored privately and isolated
- No third-party data sharing
- Owner analytics aggregated without PII

## Edge cases

- Unknown/invalid ticker handling with suggestions
- Price feed failures with retry logic
- Alert cooldown expiration during quiet hours
- Multiple alert types on same ticker

## Required tests

- End-to-end alert triggering with threshold/percent rules
- Quiet hours queue and delivery validation
- Cooldown enforcement across alert types
- Morning summary content accuracy

## Assumptions

- Price feed uses reliable market data provider with rate limits
- Default cooldown of 2h prevents alert spam
- Morning summary defaults to 8AM local time

# nginx-js Examples

## Running the Demos

1. Build the project:

   ```bash
   pnpm run build:prod
   ```

2. Open the example files in your browser:
   - `index.html` - Basic demo showing interceptors
   - `advanced.html` - Advanced demo with all features

## Basic Demo (`index.html`)

Demonstrates how nginx-js intercepts different types of network requests:

- **Fetch API**: Intercepts `fetch()` calls
- **XMLHttpRequest**: Intercepts XHR requests
- **WebSocket**: Intercepts WebSocket connections

Each interceptor plugin only handles its own relevant hooks:

- HTTP interceptors (Fetch, XHR) handle HTTP request/response hooks
- WebSocket interceptor handles WebSocket-specific hooks

## Advanced Demo (`advanced.html`)

Demonstrates all nginx-js features working together:

### Features Demonstrated

1. **Router** - Routes requests to different backends based on URL patterns
   - `/api/users/*` → routes to user endpoints
   - `/api/posts/*` → routes to post endpoints

2. **LoadBalancer** - Distributes requests across multiple backend servers
   - Round-robin strategy
   - Health checking
   - Connection tracking

3. **RateLimiter** - Limits request rate per endpoint
   - Sliding window algorithm
   - 10 requests per minute per URL
   - Automatic rate limit enforcement

4. **CircuitBreaker** - Prevents cascading failures
   - Opens circuit when failure rate exceeds threshold
   - Automatically attempts recovery
   - Protects backend services

5. **MockServer** - Mocks API responses for testing
   - Pattern-based matching
   - Configurable delays
   - Dynamic responses

### How It Works

1. Request comes in → RateLimiter checks if allowed
2. CircuitBreaker checks if circuit is open
3. MockServer checks if request matches mock rules
4. Router rewrites URL based on routing rules
5. LoadBalancer selects backend server
6. Request is sent to selected server
7. Response is logged and statistics updated

### Test Scenarios

- **Test API**: Normal requests through the full pipeline
- **Test Rate Limit**: Sends 15 rapid requests to trigger rate limiting
- **Test Circuit Breaker**: Sends requests to failing endpoint to trigger circuit breaker

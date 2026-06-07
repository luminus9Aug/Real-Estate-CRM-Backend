import Redis from 'ioredis';

async function checkQueue() {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  console.log('Connecting to Redis at:', redisUrl);
  const redis = new Redis(redisUrl);

  try {
    const keys = await redis.keys('*auth-email*');
    console.log('Found keys matching *auth-email*:', keys);

    for (const key of keys) {
      const type = await redis.type(key);
      console.log(`Key: ${key}, Type: ${type}`);
      if (type === 'hash') {
        const val = await redis.hgetall(key);
        console.log('Value:', val);
      } else if (type === 'list') {
        const val = await redis.lrange(key, 0, -1);
        console.log('Value:', val);
      } else if (type === 'set') {
        const val = await redis.smembers(key);
        console.log('Value:', val);
      } else if (type === 'zset') {
        const val = await redis.zrange(key, 0, -1, 'WITHSCORES');
        console.log('Value:', val);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await redis.quit();
  }
}

checkQueue();

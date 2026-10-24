import http from 'http';
import https from 'https';
import { URL } from 'url';

export const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 64,
  maxFreeSockets: 32,
  timeout: 15000,
  keepAliveMsecs: 60000
});

export const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 64,
  maxFreeSockets: 32,
  timeout: 15000,
  keepAliveMsecs: 60000
});

export interface PooledResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

export function pooledPostUrlEncoded(
  urlString: string,
  params: Record<string, string> | string,
  customHeaders: Record<string, string> = {},
  timeoutMs: number = 10000
): Promise<PooledResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const bodyStr = typeof params === 'string' ? params : new URLSearchParams(params).toString();
    const bodyBuffer = Buffer.from(bodyStr, 'utf8');

    const isHttps = url.protocol === 'https:';
    const requester = isHttps ? https.request : http.request;
    const agent = isHttps ? httpsAgent : httpAgent;

    const headers: Record<string, string | number> = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Content-Length': bodyBuffer.length,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      ...customHeaders
    };

    const req = requester({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      agent,
      headers,
      timeout: timeoutMs
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode || 200,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error(`Request timeout (${timeoutMs}ms)`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(bodyBuffer);
    req.end();
  });
}

export function pooledPostJson(
  urlString: string,
  payload: any,
  customHeaders: Record<string, string> = {},
  timeoutMs: number = 10000
): Promise<PooledResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const bodyBuffer = Buffer.from(bodyStr, 'utf8');

    const isHttps = url.protocol === 'https:';
    const requester = isHttps ? https.request : http.request;
    const agent = isHttps ? httpsAgent : httpAgent;

    const headers: Record<string, string | number> = {
      'Content-Type': 'application/json',
      'Content-Length': bodyBuffer.length,
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      'Accept': 'application/json',
      ...customHeaders
    };

    const req = requester({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      agent,
      headers,
      timeout: timeoutMs
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode || 200,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error(`Request timeout (${timeoutMs}ms)`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(bodyBuffer);
    req.end();
  });
}

export function pooledGet(
  urlString: string,
  customHeaders: Record<string, string> = {},
  timeoutMs: number = 10000
): Promise<PooledResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const isHttps = url.protocol === 'https:';
    const requester = isHttps ? https.request : http.request;
    const agent = isHttps ? httpsAgent : httpAgent;

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...customHeaders
    };

    const req = requester({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      agent,
      headers,
      timeout: timeoutMs
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode || 200,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error(`Request timeout (${timeoutMs}ms)`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

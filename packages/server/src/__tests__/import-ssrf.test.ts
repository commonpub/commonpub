import { describe, it, expect } from 'vitest';
import { isPrivateUrl } from '../import/ssrf';

describe('import SSRF protection', () => {
  describe('isPrivateUrl', () => {
    it('should block localhost', () => {
      expect(isPrivateUrl('http://localhost/page')).toBe(true);
      expect(isPrivateUrl('http://localhost:3000/page')).toBe(true);
      expect(isPrivateUrl('https://localhost.localdomain/page')).toBe(true);
    });

    it('should block 127.x.x.x loopback', () => {
      expect(isPrivateUrl('http://127.0.0.1/page')).toBe(true);
      expect(isPrivateUrl('http://127.0.0.2/page')).toBe(true);
      expect(isPrivateUrl('http://127.255.255.255/page')).toBe(true);
    });

    it('should block RFC 1918 Class A (10.x)', () => {
      expect(isPrivateUrl('http://10.0.0.1/page')).toBe(true);
      expect(isPrivateUrl('http://10.255.255.255/page')).toBe(true);
    });

    it('should block RFC 1918 Class B (172.16-31.x)', () => {
      expect(isPrivateUrl('http://172.16.0.1/page')).toBe(true);
      expect(isPrivateUrl('http://172.31.255.255/page')).toBe(true);
    });

    it('should allow non-private 172.x addresses', () => {
      expect(isPrivateUrl('http://172.15.0.1/page')).toBe(false);
      expect(isPrivateUrl('http://172.32.0.1/page')).toBe(false);
    });

    it('should block RFC 1918 Class C (192.168.x)', () => {
      expect(isPrivateUrl('http://192.168.0.1/page')).toBe(true);
      expect(isPrivateUrl('http://192.168.255.255/page')).toBe(true);
    });

    it('should block link-local (169.254.x)', () => {
      expect(isPrivateUrl('http://169.254.0.1/page')).toBe(true);
    });

    it('should block current network (0.x)', () => {
      expect(isPrivateUrl('http://0.0.0.0/page')).toBe(true);
    });

    it('should block CGN shared address space (100.64-127.x)', () => {
      expect(isPrivateUrl('http://100.64.0.1/page')).toBe(true);
      expect(isPrivateUrl('http://100.127.255.255/page')).toBe(true);
    });

    it('should allow non-CGN 100.x addresses', () => {
      expect(isPrivateUrl('http://100.128.0.1/page')).toBe(false);
    });

    it('should block benchmarking (198.18-19.x)', () => {
      expect(isPrivateUrl('http://198.18.0.1/page')).toBe(true);
      expect(isPrivateUrl('http://198.19.255.255/page')).toBe(true);
    });

    it('should block TEST-NET ranges', () => {
      expect(isPrivateUrl('http://192.0.2.1/page')).toBe(true);
      expect(isPrivateUrl('http://198.51.100.1/page')).toBe(true);
      expect(isPrivateUrl('http://203.0.113.1/page')).toBe(true);
    });

    it('should block cloud metadata endpoints', () => {
      expect(isPrivateUrl('http://metadata.google.internal/page')).toBe(true);
      expect(isPrivateUrl('http://metadata.internal/page')).toBe(true);
    });

    it('should block IPv6 loopback', () => {
      expect(isPrivateUrl('http://[::1]/page')).toBe(true);
    });

    it('should block IPv6 unique local', () => {
      expect(isPrivateUrl('http://[fc00::1]/page')).toBe(true);
      expect(isPrivateUrl('http://[fd12::1]/page')).toBe(true);
    });

    it('should block IPv6 link-local', () => {
      expect(isPrivateUrl('http://[fe80::1]/page')).toBe(true);
    });

    it('should block non-HTTP protocols', () => {
      expect(isPrivateUrl('ftp://example.com/file')).toBe(true);
      expect(isPrivateUrl('file:///etc/passwd')).toBe(true);
      expect(isPrivateUrl('javascript:alert(1)')).toBe(true);
    });

    it('should block malformed URLs', () => {
      expect(isPrivateUrl('not-a-url')).toBe(true);
      expect(isPrivateUrl('')).toBe(true);
    });

    it('should allow public URLs', () => {
      expect(isPrivateUrl('https://example.com/page')).toBe(false);
      expect(isPrivateUrl('https://www.hackster.io/project')).toBe(false);
      expect(isPrivateUrl('https://medium.com/@user/article')).toBe(false);
      expect(isPrivateUrl('http://dev.to/user/post')).toBe(false);
    });
  });
});

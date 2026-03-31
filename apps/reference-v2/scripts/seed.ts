/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Seed script — populates the database with realistic demo data.
 *
 * Usage: npx tsx scripts/seed.ts
 * Requires DATABASE_URL environment variable.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
// @ts-expect-error no types for pg
import pg from 'pg';

import {
  users,
  hubs,
  hubMembers,
  hubPosts,
  products,
  contentItems,
  contentProducts,
  contentTags,
  tags,
  follows,
  likes,
  comments,
  bookmarks,
  contests,
  contestEntries,
  videos,
  videoCategories,
  learningPaths,
  learningModules,
  learningLessons,
  notifications,
} from '@commonpub/schema';

const DATABASE_URL = process.env.DATABASE_URL || process.env.NUXT_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL or NUXT_DATABASE_URL required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

function uuid(): string {
  return crypto.randomUUID();
}

async function seed(): Promise<void> {
  console.log('Seeding CommonPub database...\n');

  // ═══════════════════════════════════════════════════
  // USERS (10)
  // ═══════════════════════════════════════════════════
  console.log('Creating users...');
  const userIds = Array.from({ length: 10 }, () => uuid());
  const userDefs = [
    { id: userIds[0]!, username: 'kwabena', displayName: 'Kwabena Agyeman', email: 'kwabena@example.com', headline: 'Hardware Engineer & Maker', bio: 'Building things at the intersection of electronics and craft.', location: 'Accra, Ghana', role: 'verified' as const },
    { id: userIds[1]!, username: 'jenny', displayName: 'Jenny Plunkett', email: 'jenny@example.com', headline: 'Robotics Engineer', bio: 'Making robots that see and interact with the real world.', location: 'Austin, TX', role: 'verified' as const },
    { id: userIds[2]!, username: 'marcelo', displayName: 'Marcelo Rovai', email: 'marcelo@example.com', headline: 'Maker Educator', bio: 'Teaching the world about electronics and creative technology.', location: 'São Paulo, Brazil', role: 'pro' as const },
    { id: userIds[3]!, username: 'shawn', displayName: 'Shawn Hymel', email: 'shawn@example.com', headline: 'Developer Advocate', bio: 'Tutorials, talks, and tools for makers and builders.', location: 'Raleigh, NC', role: 'verified' as const },
    { id: userIds[4]!, username: 'lena', displayName: 'Lena Owusu', email: 'lena@example.com', headline: 'Electronics Designer', bio: 'Designing custom PCBs and prototyping new hardware.', location: 'London, UK', role: 'member' as const },
    { id: userIds[5]!, username: 'dmitri', displayName: 'Dmitri Lykov', email: 'dmitri@example.com', headline: 'Robotics Engineer', bio: 'Building autonomous systems with open-source tools.', location: 'Moscow, Russia', role: 'member' as const },
    { id: userIds[6]!, username: 'amara', displayName: 'Amara Mensah', email: 'amara@example.com', headline: 'IoT Developer', bio: 'Connecting devices and building smart systems.', location: 'Nairobi, Kenya', role: 'member' as const },
    { id: userIds[7]!, username: 'pete', displayName: 'Pete Warden', email: 'pete@example.com', headline: 'Open Source Advocate', bio: 'Building tools and frameworks for the maker community.', location: 'San Francisco, CA', role: 'staff' as const },
    { id: userIds[8]!, username: 'admin', displayName: 'CommonPub Admin', email: 'admin@commonpub.dev', headline: 'Platform Administrator', bio: 'Keeping the lights on.', location: 'Everywhere', role: 'admin' as const },
    { id: userIds[9]!, username: 'sara', displayName: 'Sara Chen', email: 'sara@example.com', headline: 'Maker & Technical Writer', bio: 'Documenting projects so others can build them too.', location: 'Taipei, Taiwan', role: 'member' as const },
  ];

  for (const u of userDefs) {
    await db.insert(users).values({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      email: u.email,
      emailVerified: true,
      headline: u.headline,
      bio: u.bio,
      location: u.location,
      role: u.role,
      skills: ['Electronics', 'Prototyping', '3D Printing', 'Python', 'C/C++'].slice(0, 3 + Math.floor(Math.random() * 3)),
      socialLinks: { github: `https://github.com/${u.username}` },
    }).onConflictDoNothing();
  }

  // ═══════════════════════════════════════════════════
  // COMPANY HUBS (3)
  // ═══════════════════════════════════════════════════
  console.log('Creating company hubs...');
  const companyHubIds = [uuid(), uuid(), uuid()];
  const companies = [
    { id: companyHubIds[0]!, name: 'Espressif Systems', slug: 'espressif', description: 'Makers of ESP32 — the world\'s most popular Wi-Fi+Bluetooth SoC for IoT.', website: 'https://espressif.com' },
    { id: companyHubIds[1]!, name: 'Arduino', slug: 'arduino', description: 'Open-source electronics platform. Making hardware accessible to everyone.', website: 'https://arduino.cc' },
    { id: companyHubIds[2]!, name: 'Raspberry Pi Foundation', slug: 'raspberry-pi', description: 'Low-cost, high-performance computing for learning and making.', website: 'https://raspberrypi.org' },
  ];

  for (const c of companies) {
    await db.insert(hubs).values({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      hubType: 'company',
      privacy: 'public',
      joinPolicy: 'open',
      website: c.website,
      createdById: userIds[8]!,
      isOfficial: true,
      memberCount: 0,
      postCount: 0,
    }).onConflictDoNothing();
  }

  // ═══════════════════════════════════════════════════
  // PRODUCT HUBS (8)
  // ═══════════════════════════════════════════════════
  console.log('Creating product hubs and products...');
  const productHubDefs = [
    { name: 'ESP32-S3-DevKitC-1', slug: 'esp32-s3-devkitc', desc: 'Development board featuring ESP32-S3 with 16MB Flash and 8MB PSRAM.', parent: companyHubIds[0]!, category: 'microcontroller' as const, price: 12.90, purchase: 'https://www.espressif.com/en/products/devkits/esp32-s3-devkitc-1' },
    { name: 'ESP32-C3-DevKitM-1', slug: 'esp32-c3-devkitm', desc: 'Ultra-low-power RISC-V microcontroller with Wi-Fi and BLE.', parent: companyHubIds[0]!, category: 'microcontroller' as const, price: 8.00, purchase: 'https://www.espressif.com/en/products/devkits/esp32-c3-devkitm-1' },
    { name: 'Arduino Nano 33 BLE Sense', slug: 'arduino-nano-33-ble-sense', desc: 'Compact board with BLE, IMU, microphone, and environmental sensors.', parent: companyHubIds[1]!, category: 'microcontroller' as const, price: 33.40, purchase: 'https://store.arduino.cc/nano-33-ble-sense' },
    { name: 'Arduino Nicla Vision', slug: 'arduino-nicla-vision', desc: '2MP camera, dual-core STM32, and ToF sensor in a tiny form factor.', parent: companyHubIds[1]!, category: 'sbc' as const, price: 80.00, purchase: 'https://store.arduino.cc/nicla-vision' },
    { name: 'Raspberry Pi 5', slug: 'raspberry-pi-5', desc: 'Quad-core Arm Cortex-A76 at 2.4GHz with 4/8GB LPDDR4X.', parent: companyHubIds[2]!, category: 'sbc' as const, price: 60.00, purchase: 'https://raspberrypi.com/products/raspberry-pi-5/' },
    { name: 'Coral USB Accelerator', slug: 'coral-usb-accelerator', desc: 'Edge TPU coprocessor for fast ML inference over USB.', parent: companyHubIds[0]!, category: 'other' as const, price: 59.99, purchase: 'https://coral.ai/products/accelerator' },
    { name: 'OV2640 Camera Module', slug: 'ov2640-camera', desc: '2MP CMOS camera module, 24-pin FPC connector, DVP interface.', parent: companyHubIds[0]!, category: 'sensor' as const, price: 6.50, purchase: '' },
    { name: 'TensorFlow Lite Micro', slug: 'tflite-micro', desc: 'Lightweight ML inference framework for microcontrollers.', parent: companyHubIds[0]!, category: 'software' as const, price: 0, purchase: 'https://www.tensorflow.org/lite/microcontrollers' },
  ];

  const productIds: string[] = [];
  for (const p of productHubDefs) {
    const hubId = uuid();
    const productId = uuid();
    productIds.push(productId);

    await db.insert(hubs).values({
      id: hubId,
      name: p.name,
      slug: p.slug,
      description: p.desc,
      hubType: 'product',
      privacy: 'public',
      joinPolicy: 'open',
      parentHubId: p.parent,
      website: p.purchase || null,
      createdById: userIds[8]!,
      isOfficial: true,
      memberCount: 0,
      postCount: 0,
    }).onConflictDoNothing();

    await db.insert(products).values({
      id: productId,
      name: p.name,
      slug: p.slug,
      description: p.desc,
      hubId,
      category: p.category,
      purchaseUrl: p.purchase || null,
      pricing: p.price > 0 ? { min: p.price, max: p.price, currency: 'USD' } : null,
      status: 'active',
      createdById: userIds[8]!,
    }).onConflictDoNothing();
  }

  // ═══════════════════════════════════════════════════
  // COMMUNITY HUBS (3)
  // ═══════════════════════════════════════════════════
  console.log('Creating community hubs...');
  const communityHubIds = [uuid(), uuid(), uuid()];
  const communityDefs = [
    { id: communityHubIds[0]!, name: 'Hardware Builders', slug: 'hardware-builders', desc: 'A community for makers building and sharing hardware projects.' },
    { id: communityHubIds[1]!, name: 'Electronics Enthusiasts', slug: 'electronics-enthusiasts', desc: 'Circuit design, PCB layout, and hands-on electronics for the curious.' },
    { id: communityHubIds[2]!, name: 'AfricaTech Makers', slug: 'africatech-makers', desc: 'Makers across the African continent building the future.' },
  ];

  for (const c of communityDefs) {
    await db.insert(hubs).values({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.desc,
      hubType: 'community',
      privacy: 'public',
      joinPolicy: 'open',
      createdById: userIds[0]!,
      memberCount: 5,
      postCount: 3,
    }).onConflictDoNothing();

    // Add members
    for (let i = 0; i < 5; i++) {
      await db.insert(hubMembers).values({
        hubId: c.id,
        userId: userIds[i]!,
        role: i === 0 ? 'owner' : i === 1 ? 'moderator' : 'member',
      }).onConflictDoNothing();
    }

    // Add posts
    for (let i = 0; i < 3; i++) {
      await db.insert(hubPosts).values({
        hubId: c.id,
        authorId: userIds[i]!,
        type: 'text',
        content: [
          'Just finished my first automated planter build! Soil sensors working great with the web dashboard.',
          'Anyone tried the new Raspberry Pi 5 for a home server? Curious about real-world performance.',
          'Sharing my experience building a CNC from salvaged parts — surprisingly capable for under $50!',
        ][i]!,
      });
    }
  }

  // ═══════════════════════════════════════════════════
  // TAGS
  // ═══════════════════════════════════════════════════
  console.log('Creating tags...');
  const tagDefs = ['hardware', 'electronics', 'robotics', '3d-printing', 'woodworking', 'cnc', 'iot', 'python', 'c-cpp', 'open-source', 'diy', 'automation', 'prototyping', 'metalwork', 'software'];
  const tagIds: string[] = [];
  for (const t of tagDefs) {
    const id = uuid();
    tagIds.push(id);
    await db.insert(tags).values({ id, name: t, slug: t, category: 'topic' }).onConflictDoNothing();
  }

  // ═══════════════════════════════════════════════════
  // CONTENT (projects, articles, blogs, explainers)
  // ═══════════════════════════════════════════════════
  console.log('Creating content...');
  const contentDefs = [
    // PROJECTS (8)
    { type: 'project' as const, title: 'Automated Plant Watering System', slug: 'automated-plant-watering', desc: 'Build an IoT-connected watering system with soil moisture sensors and a web dashboard.', author: 0, difficulty: 'intermediate' as const, buildTime: '4 hours', cost: '$45–$65', productRefs: [0, 6, 7] },
    { type: 'project' as const, title: 'CNC Engraver from Salvaged Parts', slug: 'cnc-engraver-salvaged', desc: 'A functional CNC engraver built from repurposed DVD drives and 3D-printed brackets.', author: 4, difficulty: 'advanced' as const, buildTime: '20 hours', cost: '$150–$200', productRefs: [] },
    { type: 'project' as const, title: 'Custom Mechanical Keyboard Build', slug: 'custom-mech-keyboard', desc: 'Hand-wired split keyboard with custom PCB, hotswap sockets, and QMK firmware.', author: 3, difficulty: 'intermediate' as const, buildTime: '6 hours', cost: '$80–$120', productRefs: [2] },
    { type: 'project' as const, title: 'Smart Plant Monitor with Sensors', slug: 'smart-plant-monitor', desc: 'Wireless soil moisture and light sensor with data logging and alerts.', author: 9, difficulty: 'beginner' as const, buildTime: '2 hours', cost: '$40–$55', productRefs: [2] },
    { type: 'project' as const, title: 'Solar-Powered Weather Station', slug: 'solar-weather-station', desc: 'Off-grid weather station with solar charging and wireless data reporting.', author: 0, difficulty: 'advanced' as const, buildTime: '12 hours', cost: '$80–$120', productRefs: [4, 5] },
    { type: 'project' as const, title: 'Line-Following Robot', slug: 'line-following-robot', desc: 'Autonomous robot using IR sensors and PID control for smooth line tracking.', author: 5, difficulty: 'beginner' as const, buildTime: '3 hours', cost: '$35–$50', productRefs: [0, 6] },
    { type: 'project' as const, title: 'LED Matrix Display Controller', slug: 'led-matrix-controller', desc: 'Custom LED panel controller with animations, text scrolling, and a web interface.', author: 2, difficulty: 'intermediate' as const, buildTime: '5 hours', cost: '$35–$45', productRefs: [2, 7] },
    { type: 'project' as const, title: 'Automated Greenhouse Controller', slug: 'greenhouse-controller', desc: 'Environmental monitoring and control system for temperature, humidity, and ventilation.', author: 1, difficulty: 'advanced' as const, buildTime: '8 hours', cost: '$60–$90', productRefs: [4] },
    // ARTICLES (5)
    { type: 'article' as const, title: 'The Future of Open Hardware', slug: 'future-open-hardware', desc: 'How open-source hardware is reshaping product design and manufacturing.', author: 7, productRefs: [] },
    { type: 'article' as const, title: 'PCB Design for Beginners: From Schematic to Board', slug: 'pcb-design-beginners', desc: 'A practical guide to designing your first printed circuit board with KiCad.', author: 3, productRefs: [] },
    { type: 'article' as const, title: 'Choosing the Right Microcontroller in 2026', slug: 'choosing-mcu-2026', desc: 'A comprehensive comparison of popular microcontrollers for maker projects.', author: 7, productRefs: [] },
    { type: 'article' as const, title: 'Introduction to CNC Machining for Makers', slug: 'cnc-machining-intro', desc: 'G-code basics, toolpath strategies, and material selection for home CNC setups.', author: 4, productRefs: [] },
    { type: 'article' as const, title: 'Power Management for Battery-Powered Projects', slug: 'power-management-battery', desc: 'Techniques for efficient power design in portable and solar-powered builds.', author: 0, productRefs: [] },
    // BLOGS (4)
    { type: 'blog' as const, title: 'My Journey Building a Home Automation System', slug: 'home-automation-journey', desc: 'A personal account of automating my home with open-source tools.', author: 2, productRefs: [] },
    { type: 'blog' as const, title: 'Why I Started Designing My Own PCBs', slug: 'designing-own-pcbs', desc: 'The pros and cons of going from breadboard prototypes to custom boards.', author: 9, productRefs: [] },
    { type: 'blog' as const, title: 'Lessons from Running a Maker Space in Nairobi', slug: 'maker-space-nairobi', desc: 'What I learned about community building in environments with limited resources.', author: 6, productRefs: [] },
    { type: 'blog' as const, title: 'The Maker Community Needs Better Documentation', slug: 'maker-community-documentation', desc: 'A case for treating documentation as a first-class deliverable.', author: 9, productRefs: [] },
    // EXPLAINERS (3)
    { type: 'explainer' as const, title: 'How Electric Motors Work', slug: 'how-electric-motors-work', desc: 'An interactive guide to DC motors, stepper motors, and servos.', author: 3, productRefs: [] },
    { type: 'explainer' as const, title: 'Understanding 3D Printing Technologies', slug: 'understanding-3d-printing', desc: 'From FDM to SLA — how each printing technology works and when to use it.', author: 1, productRefs: [] },
    { type: 'explainer' as const, title: 'The Basics of Circuit Design', slug: 'basics-circuit-design', desc: 'An interactive walkthrough of voltage, current, resistance, and basic components.', author: 4, productRefs: [] },
  ];

  const contentIds: string[] = [];
  for (const c of contentDefs) {
    const id = uuid();
    contentIds.push(id);

    await db.insert(contentItems).values({
      id,
      authorId: userIds[c.author]!,
      type: c.type,
      title: c.title,
      slug: c.slug,
      description: c.desc,
      status: 'published',
      visibility: 'public',
      difficulty: (c as any).difficulty ?? null,
      buildTime: (c as any).buildTime ?? null,
      estimatedCost: (c as any).cost ?? null,
      publishedAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
      viewCount: Math.floor(Math.random() * 10000) + 100,
      likeCount: Math.floor(Math.random() * 300) + 10,
      commentCount: Math.floor(Math.random() * 50) + 1,
      forkCount: c.type === 'project' ? Math.floor(Math.random() * 50) : 0,
    }).onConflictDoNothing();

    // Link products via BOM
    for (const pIdx of c.productRefs) {
      if (productIds[pIdx]) {
        await db.insert(contentProducts).values({
          contentId: id,
          productId: productIds[pIdx]!,
          quantity: 1,
          role: 'main_board',
          required: true,
        }).onConflictDoNothing();
      }
    }

    // Add 2 tags per content item
    const tagSlice = tagIds.slice(Math.floor(Math.random() * 10), Math.floor(Math.random() * 10) + 3);
    for (const tId of tagSlice) {
      if (tId) {
        await db.insert(contentTags).values({ contentId: id, tagId: tId }).onConflictDoNothing();
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // SOCIAL DATA (follows, likes, comments, bookmarks)
  // ═══════════════════════════════════════════════════
  console.log('Creating social data...');

  // Follows: create a social graph
  const followPairs = [[0,1],[0,3],[1,0],[1,3],[2,0],[2,7],[3,0],[3,1],[4,0],[5,2],[6,0],[7,3],[9,0],[9,1],[9,2]];
  for (const [a, b] of followPairs) {
    await db.insert(follows).values({
      followerId: userIds[a!]!,
      followingId: userIds[b!]!,
    }).onConflictDoNothing();
  }

  // Likes on first 10 content items
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 3; j++) {
      const userId = userIds[(i + j + 1) % 10]!;
      await db.insert(likes).values({
        userId,
        targetType: contentDefs[i]!.type as 'project' | 'article' | 'blog' | 'explainer',
        targetId: contentIds[i]!,
      }).onConflictDoNothing();
    }
  }

  // Comments on first 5 content items
  for (let i = 0; i < 5; i++) {
    await db.insert(comments).values({
      authorId: userIds[(i + 2) % 10]!,
      targetType: contentDefs[i]!.type as 'project' | 'article' | 'blog' | 'explainer',
      targetId: contentIds[i]!,
      content: [
        'Great project! I replicated this with different sensors and got similar results.',
        'The wiring diagram was really helpful. Would love to see a weatherproof version.',
        'This inspired me to start my own automation project. Thanks for sharing!',
        'Have you tested this outdoors? Curious about how the enclosure holds up.',
        'Excellent write-up. The build steps are clear and well-documented.',
      ][i]!,
    });
  }

  // Bookmarks
  for (let i = 0; i < 5; i++) {
    await db.insert(bookmarks).values({
      userId: userIds[0]!,
      targetType: contentDefs[i]!.type as 'project' | 'article' | 'blog' | 'explainer',
      targetId: contentIds[i]!,
    }).onConflictDoNothing();
  }

  // ═══════════════════════════════════════════════════
  // VIDEO CATEGORIES & VIDEOS (8)
  // ═══════════════════════════════════════════════════
  console.log('Creating videos...');
  const catDefs = [
    { name: 'Tutorial', slug: 'tutorial', sortOrder: 0 },
    { name: 'Talk', slug: 'talk', sortOrder: 1 },
    { name: 'Demo', slug: 'demo', sortOrder: 2 },
    { name: 'Stream', slug: 'stream', sortOrder: 3 },
    { name: 'Review', slug: 'review', sortOrder: 4 },
  ];
  for (const c of catDefs) {
    await db.insert(videoCategories).values({ name: c.name, slug: c.slug, sortOrder: c.sortOrder }).onConflictDoNothing();
  }

  const videoDefs = [
    { title: 'Building a Custom Mechanical Keyboard from Scratch', author: 3, platform: 'youtube' as const, duration: '42:18', url: 'https://youtube.com/watch?v=example1' },
    { title: 'CNC Basics: Your First Cuts in Aluminum', author: 1, platform: 'youtube' as const, duration: '28:44', url: 'https://youtube.com/watch?v=example2' },
    { title: 'Keynote: The State of Open Hardware in 2026', author: 7, platform: 'youtube' as const, duration: '58:30', url: 'https://youtube.com/watch?v=example3' },
    { title: 'Autonomous Line-Following Robot Demo', author: 5, platform: 'youtube' as const, duration: '12:05', url: 'https://youtube.com/watch?v=example4' },
    { title: 'Live Build: LED Matrix Display in 90 Minutes', author: 2, platform: 'youtube' as const, duration: '1:42:20', url: 'https://youtube.com/watch?v=example5' },
    { title: 'Raspberry Pi 5 vs Orange Pi 5 for Home Server', author: 7, platform: 'youtube' as const, duration: '35:12', url: 'https://youtube.com/watch?v=example6' },
    { title: 'Designing Your First PCB with KiCad', author: 3, platform: 'youtube' as const, duration: '22:56', url: 'https://youtube.com/watch?v=example7' },
    { title: 'Automated Greenhouse Build: Full Walkthrough', author: 1, platform: 'youtube' as const, duration: '18:09', url: 'https://youtube.com/watch?v=example8' },
  ];

  for (const v of videoDefs) {
    await db.insert(videos).values({
      authorId: userIds[v.author]!,
      title: v.title,
      url: v.url,
      platform: v.platform,
      duration: v.duration,
      viewCount: Math.floor(Math.random() * 50000) + 1000,
      likeCount: Math.floor(Math.random() * 2000) + 50,
    });
  }

  // ═══════════════════════════════════════════════════
  // CONTESTS (2)
  // ═══════════════════════════════════════════════════
  console.log('Creating contests...');
  const now = new Date();
  const contestId1 = uuid();
  const contestId2 = uuid();

  await db.insert(contests).values({
    id: contestId1,
    title: 'Maker Challenge 2026',
    slug: 'maker-challenge-2026',
    description: 'Build the most creative maker project. $15,000 in prizes.',
    rules: 'Projects must be fully documented and reproducible. Open-source preferred.',
    status: 'active',
    startDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
    endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    prizes: [
      { place: 1, title: 'Grand Prize', value: '$5,000', description: 'Best overall project' },
      { place: 2, title: 'Runner Up', value: '$3,000' },
      { place: 3, title: 'Third Place', value: '$2,000' },
    ],
    judges: [userIds[7]!, userIds[3]!],
    createdById: userIds[8]!,
    entryCount: 3,
  });

  // Submit some entries
  for (let i = 0; i < 3; i++) {
    await db.insert(contestEntries).values({
      contestId: contestId1,
      contentId: contentIds[i]!,
      userId: userIds[contentDefs[i]!.author]!,
    });
  }

  await db.insert(contests).values({
    id: contestId2,
    title: 'Build Showcase 2025',
    slug: 'build-showcase-2025',
    description: 'Show us what you built this year. Community voted.',
    status: 'completed',
    startDate: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000),
    endDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
    prizes: [
      { place: 1, title: 'Winner', value: '$1,000' },
      { place: 2, title: 'Runner Up', value: '$500' },
    ],
    createdById: userIds[8]!,
    entryCount: 0,
  });

  // ═══════════════════════════════════════════════════
  // LEARNING PATHS (2)
  // ═══════════════════════════════════════════════════
  console.log('Creating learning paths...');
  const pathId1 = uuid();
  const pathId2 = uuid();

  await db.insert(learningPaths).values({
    id: pathId1,
    title: 'Getting Started with Electronics',
    slug: 'getting-started-electronics',
    description: 'A complete beginner path from zero to building your first circuit and project.',
    difficulty: 'beginner',
    estimatedHours: '12',
    authorId: userIds[3]!,
    status: 'published',
    enrollmentCount: 248,
    completionCount: 67,
  });

  const mod1 = uuid();
  const mod2 = uuid();
  await db.insert(learningModules).values([
    { id: mod1, pathId: pathId1, title: 'Foundations', description: 'Basic concepts: voltage, current, and components.', sortOrder: 0 },
    { id: mod2, pathId: pathId1, title: 'Your First Circuit', description: 'Build and test a simple LED circuit on a breadboard.', sortOrder: 1 },
  ]);

  await db.insert(learningLessons).values([
    { moduleId: mod1, title: 'What is Electronics?', slug: 'what-is-electronics', type: 'article', sortOrder: 0, duration: 10 },
    { moduleId: mod1, title: 'Setting Up Your Workbench', slug: 'setup-workbench', type: 'article', sortOrder: 1, duration: 15 },
    { moduleId: mod2, title: 'Reading Schematics', slug: 'reading-schematics', type: 'article', sortOrder: 0, duration: 20 },
    { moduleId: mod2, title: 'Breadboarding Basics', slug: 'breadboarding-basics', type: 'video', sortOrder: 1, duration: 30 },
    { moduleId: mod2, title: 'Your First Soldered Project', slug: 'first-soldered-project', type: 'project', sortOrder: 2, duration: 45 },
  ]);

  await db.insert(learningPaths).values({
    id: pathId2,
    title: 'Advanced PCB Design',
    slug: 'advanced-pcb-design',
    description: 'Deep dive into multi-layer PCB design, signal integrity, and manufacturing.',
    difficulty: 'advanced',
    estimatedHours: '24',
    authorId: userIds[1]!,
    status: 'published',
    enrollmentCount: 89,
    completionCount: 12,
  });

  // ═══════════════════════════════════════════════════
  // NOTIFICATIONS (for kwabena)
  // ═══════════════════════════════════════════════════
  console.log('Creating notifications...');
  await db.insert(notifications).values([
    { userId: userIds[0]!, type: 'like', title: 'New like', message: 'Jenny liked your project "Automated Plant Watering System"', actorId: userIds[1]! },
    { userId: userIds[0]!, type: 'comment', title: 'New comment', message: 'Marcelo commented on your project', actorId: userIds[2]! },
    { userId: userIds[0]!, type: 'follow', title: 'New follower', message: 'Sara started following you', actorId: userIds[9]! },
    { userId: userIds[0]!, type: 'contest', title: 'Contest update', message: 'Maker Challenge 2026 is now accepting entries!' },
  ]);

  console.log('\nSeed complete!');
  console.log(`  Users: ${userDefs.length}`);
  console.log(`  Company hubs: ${companies.length}`);
  console.log(`  Product hubs: ${productHubDefs.length}`);
  console.log(`  Products: ${productHubDefs.length}`);
  console.log(`  Community hubs: ${communityDefs.length}`);
  console.log(`  Content items: ${contentDefs.length}`);
  console.log(`  Videos: ${videoDefs.length}`);
  console.log(`  Contests: 2`);
  console.log(`  Learning paths: 2`);

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

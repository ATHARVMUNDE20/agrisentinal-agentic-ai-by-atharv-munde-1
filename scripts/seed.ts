/**
 * AgriSentinel — database seeder
 * Generates a farm, fields, 14 days of realistic telemetry, and starter alerts.
 * Run: bun /home/z/my-project/scripts/seed.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Deterministic PRNG so demos are reproducible
let seedState = 42;
function rand() {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
function gaussian(mean: number, std: number) {
  const u = Math.max(rand(), 1e-9);
  const v = Math.max(rand(), 1e-9);
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}
const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;

type FieldSpec = {
  name: string;
  crop: string;
  variety: string;
  area: number;
  soil: string;
  irrigation: string;
  baseYield: number;
  profile: "healthy" | "drought" | "nitrogen" | "heat" | "pest" | "recovering";
};

const FIELD_SPECS: FieldSpec[] = [
  { name: "North Wheat Block", crop: "Wheat", variety: "HD-3086", area: 12.5, soil: "loam", irrigation: "canal", baseYield: 4.8, profile: "healthy" },
  { name: "Rice Terrace Paddy", crop: "Rice", variety: "Pusa Basmati-1", area: 8.0, soil: "clay", irrigation: "flood", baseYield: 5.5, profile: "healthy" },
  { name: "Tomato Polyplot", crop: "Tomato", variety: "Arka Rakshak", area: 3.2, soil: "sandy loam", irrigation: "drip", baseYield: 24.0, profile: "drought" },
  { name: "Maize East Ridge", crop: "Maize", variety: "DKC-9144", area: 6.4, soil: "silt loam", irrigation: "sprinkler", baseYield: 9.2, profile: "nitrogen" },
  { name: "Cotton Southwest", crop: "Cotton", variety: "Bollgard-3", area: 9.8, soil: "black cotton", irrigation: "drip", baseYield: 2.9, profile: "pest" },
  { name: "Soybean Riverbank", crop: "Soybean", variety: "JS-335", area: 5.1, soil: "alluvial", irrigation: "rainfed", baseYield: 3.1, profile: "heat" },
];

const HOURS_PER_STEP = 3;
const STEPS = 14 * 8; // 14 days, every 3h

async function main() {
  console.log("Clearing existing data…");
  await db.chatMessage.deleteMany();
  await db.agentRun.deleteMany();
  await db.diagnosis.deleteMany();
  await db.alert.deleteMany();
  await db.sensorReading.deleteMany();
  await db.field.deleteMany();
  await db.farm.deleteMany();

  const farm = await db.farm.create({
    data: {
      name: "Green Valley Cooperative Farm",
      location: "Nashik District",
      region: "Maharashtra, India",
    },
  });
  console.log(`Farm created: ${farm.name}`);

  const now = Date.now();

  for (let fi = 0; fi < FIELD_SPECS.length; fi++) {
    const spec = FIELD_SPECS[fi];
    const field = await db.field.create({
      data: {
        farmId: farm.id,
        name: spec.name,
        crop: spec.crop,
        variety: spec.variety,
        areaHectares: spec.area,
        location: `${farm.location} — Sector ${String(fi + 1).padStart(2, "0")}`,
        soilType: spec.soil,
        irrigation: spec.irrigation,
        plantedAt: new Date(now - 60 * 24 * 3600 * 1000),
        status: "HEALTHY",
        baseYieldTonsPerHa: spec.baseYield,
      },
    });

    const readings: {
      fieldId: string;
      recordedAt: Date;
      soilMoisture: number;
      temperature: number;
      humidity: number;
      soilPh: number;
      ndvi: number;
      lightIntensity: number;
      rainfallMm: number;
      nitrogen: number;
      phosphorus: number;
      potassium: number;
    }[] = [];

    // Baselines per profile
    let moisture = spec.profile === "drought" ? 41 : spec.profile === "heat" ? 44 : 58;
    let ndvi = spec.profile === "nitrogen" ? 0.52 : 0.66;
    let nitrogen = spec.profile === "nitrogen" ? 22 : 52;

    for (let step = STEPS; step >= 0; step--) {
      const recordedAt = new Date(now - step * HOURS_PER_STEP * 3600 * 1000);
      const hourOfDay = recordedAt.getUTCHours();
      const diurnal = Math.sin(((hourOfDay - 6) / 24) * Math.PI); // mid-day bump

      // drift dynamics per profile
      if (spec.profile === "drought") moisture = clamp(moisture - 0.09 + gaussian(0, 0.8) + (spec.irrigation === "drip" && hourOfDay === 6 ? 1.4 : 0), 14, 90);
      else moisture = clamp(moisture - 0.02 + gaussian(0, 1.1) + (hourOfDay === 6 ? 2.2 : 0), 14, 90);

      const temp = clamp(24 + diurnal * 9 + gaussian(0, 1.4) + (spec.profile === "heat" ? 4.5 : 0), 8, 47);
      const humidity = clamp(62 - diurnal * 22 + gaussian(0, 4) + (spec.profile === "pest" ? 12 : 0), 15, 98);
      ndvi = clamp(ndvi + gaussian(0, 0.012) + (spec.profile === "nitrogen" ? 0 : 0.0004), 0.12, 0.92);
      nitrogen = clamp(nitrogen + gaussian(0, 0.7) + (spec.profile === "nitrogen" ? -0.02 : 0.01), 8, 120);
      const phosphorus = clamp(gaussian(spec.profile === "nitrogen" ? 14 : 31, 3), 5, 80);
      const potassium = clamp(gaussian(42, 4), 10, 100);
      const ph = clamp(gaussian(6.6, 0.15), 4.5, 8.5);
      const light = clamp(28 + diurnal * 62 + gaussian(0, 5), 0, 130);
      const rainfall = spec.profile === "drought" ? (rand() < 0.03 ? round1(rand() * 2) : 0) : rand() < 0.12 ? round1(rand() * 6) : 0;

      readings.push({
        fieldId: field.id,
        recordedAt,
        soilMoisture: round1(moisture),
        temperature: round1(temp),
        humidity: round1(humidity),
        soilPh: round2(ph),
        ndvi: round2(ndvi),
        lightIntensity: round1(light),
        rainfallMm: rainfall,
        nitrogen: round1(nitrogen),
        phosphorus: round1(phosphorus),
        potassium: round1(potassium),
      });
    }

    await db.sensorReading.createMany({ data: readings });

    // Derive field status from the freshest reading
    const latest = readings[readings.length - 1];
    let status = "HEALTHY";
    if (latest.soilMoisture < 25 || latest.ndvi < 0.35) status = "STRESS";
    else if (latest.soilMoisture < 32 || latest.ndvi < 0.45 || latest.nitrogen < 24) status = "WATCH";
    await db.field.update({ where: { id: field.id }, data: { status } });
    console.log(`  Field ${field.name}: ${readings.length} readings, status ${status}`);
  }

  // Starter alerts (rule-seeded so the Alerts view is populated on first load)
  const fields = await db.field.findMany({ orderBy: { createdAt: "asc" } });
  const tomato = fields.find((f) => f.name === "Tomato Polyplot");
  const maize = fields.find((f) => f.name === "Maize East Ridge");

  await db.alert.createMany({
    data: [
      {
        fieldId: tomato?.id ?? null,
        severity: "HIGH",
        type: "DROUGHT_RISK",
        title: "Soil moisture trending below safe band",
        message: "Tomato Polyplot has recorded a steady moisture decline over the last 7 days. Continuous deficit may trigger blossom-end rot and flower drop.",
        recommendation: "Schedule a 45-minute drip cycle tonight (02:00-02:45), then re-check moisture at 06:00. Mulch exposed beds to cut evaporation by an estimated 18%.",
        agentReasoning: "Moisture z-score vs 7-day baseline = -2.3 sigma; downward slope persisted 96h; no rainfall compensation observed.",
        source: "RULES",
        status: "OPEN",
      },
      {
        fieldId: maize?.id ?? null,
        severity: "MEDIUM",
        type: "NUTRIENT",
        title: "Nitrogen level drifting below crop-safe threshold",
        message: "Available N has drifted under 24 ppm during peak vegetative demand for maize. NDVI growth curve is flattening against the expected sigmoid.",
        recommendation: "Top-dress 40 kg/ha urea split into two applications 10 days apart; avoid application before forecast rain to prevent leaching.",
        agentReasoning: "N slope -0.6 ppm/day across 10 days; NDVI second derivative negative; crop stage = V10 high demand.",
        source: "RULES",
        status: "OPEN",
      },
    ],
  });

  const counts = {
    fields: await db.field.count(),
    readings: await db.sensorReading.count(),
    alerts: await db.alert.count(),
  };
  console.log("Seed complete:", JSON.stringify(counts));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

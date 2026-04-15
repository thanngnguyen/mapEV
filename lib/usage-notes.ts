import type { UsageNote } from "@/types/ev-map";

export const usageNotes: UsageNote[] = [
  {
    id: "note-1",
    title: "Check connector and power first",
    description:
      "Match your vehicle connector standard before plugging in and choose power that your battery system supports.",
  },
  {
    id: "note-2",
    title: "Keep charging window between 20% and 80%",
    description:
      "For daily usage, this range helps battery health and reduces time spent at the station.",
  },
  {
    id: "note-3",
    title: "Move the vehicle after charging",
    description:
      "Once charging is done, move your vehicle to avoid congestion and idle parking penalties.",
  },
  {
    id: "note-4",
    title: "Avoid damaged cables",
    description:
      "If cable insulation looks broken or connector is overheated, do not use that charger and report it.",
  },
  {
    id: "note-5",
    title: "Know emergency stop location",
    description:
      "Before charging starts, identify the emergency stop button on the station for quick reaction if needed.",
  },
];

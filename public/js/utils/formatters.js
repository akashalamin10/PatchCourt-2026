export function shortId(id) {
  return "#" + id.slice(-4).toUpperCase();
}

export function formatReward(reward) {
  if (reward === undefined || reward === null || reward === "") return "—";
  return "$" + reward;
}

export function formatPercent(value) {
  if (value === undefined || value === null) return "—";
  return value + "%";
}

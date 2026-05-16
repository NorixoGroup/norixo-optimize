import { fetchAirbnbRuntimeGraphql } from "../lib/airbnb/runtime/fetchAirbnbRuntimeGraphql";

(async () => {
  const result = await fetchAirbnbRuntimeGraphql(
    "https://www.airbnb.fr/rooms/1465932264852038989?adults=4&check_in=2026-05-20&check_out=2026-05-25&guests=4"
  );

  console.log(JSON.stringify(result, null, 2));
})();

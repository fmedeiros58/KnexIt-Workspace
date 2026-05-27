"use client";

import { Suspense } from "react";
import "../../../knexwriter/src/modules/Knexread/native-pdf-reader/web/styles/knexread.css";
import RoutedPage from "../../../knexwriter/src/modules/Knexread/native-pdf-reader/web/page";

export default function KnexreadWebRoutePage() {
  return (
    <Suspense fallback={null}>
      <RoutedPage />
    </Suspense>
  );
}

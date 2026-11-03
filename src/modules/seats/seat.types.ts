export type EffectiveSeatStatus =
  | "AVAILABLE"
  | "HELD"
  | "BOOKED";

export type SeatMapSeat = {
  id: string;
  label: string;
  seatNumber: number;
  seatType: string;
  status: EffectiveSeatStatus;
};

export type SeatMapRow = {
  label: string;
  seats: SeatMapSeat[];
};

export type SeatMapSection = {
  id: string;
  name: string;
  category: string;
  price: string;
  rows: SeatMapRow[];
};

export type SeatMapSummary = {
  totalSeats: number;
  availableSeats: number;
  heldSeats: number;
  bookedSeats: number;
};

export type SeatMapData = {
  show: {
    id: string;
    startTime: string;
    endTime: string;
    movie: {
      title: string;
    };
    theatre: {
      name: string;
      address: string;
      city: string;
    };
    screen: {
      name: string;
    };
  };
  sections: SeatMapSection[];
  summary: SeatMapSummary;
};

export type SeatMapApiResponse = {
  success: boolean;
  data?: SeatMapData;
  message?: string;
};
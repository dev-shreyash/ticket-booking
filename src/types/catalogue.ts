export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PublicMovie = {
  id: string;
  title: string;
  description: string;
  duration: number;
  language: string;
  genre: string;
  certification: string;
  posterUrl: string | null;
  releaseDate: string;
};

export type PublicTheatre = {
  id: string;
  name: string;
  address: string;
  city: string;
  screenCount: number;
};

export type PublicShow = {
  id: string;
  startTime: string;
  endTime: string;
  movie: {
    id: string;
    title: string;
    language: string;
    duration: number;
    certification: string;
    posterUrl: string | null;
  };
  screen: {
    id: string;
    name: string;
    theatre: {
      id: string;
      name: string;
      address: string;
      city: string;
    };
  };
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  pagination?: Pagination;
  message?: string;
};

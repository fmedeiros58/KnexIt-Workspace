export type PageFrameModel = {
  pageNumber: number;
  width: number;
  height: number;
  left: number;
  top: number;
};

export type PagePairFrameModel = {
  pageNumber: number;
  source: PageFrameModel;
  translation: PageFrameModel;
  width: number;
  height: number;
  left: number;
  top: number;
};

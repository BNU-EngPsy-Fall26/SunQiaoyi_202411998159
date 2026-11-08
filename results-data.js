(function registerFormalResults(global) {
  'use strict';

  global.HW2_FORMAL_RESULTS = {
    frozenAt: '2026-11-08',
    n: 12,
    totalTrials: 1728,
    exclusions: {
      fastGraphical: 3,
      focusLostGraphical: 3,
      lowAccuracyParticipants: 0,
      incompleteRecords: 0
    },
    hypotheses: [
      {
        id: 'H1',
        experiment: 'Flanker 经典效应',
        result: '普通排列的反应时干扰为 47.3 ms，p = .003；一致和不一致条件的正确率均为 97.9%。',
        verdict: '部分支持',
        tone: 'partial'
      },
      {
        id: 'H2',
        experiment: '目标隔离改进',
        result: '普通排列与目标隔离的干扰效应分别为 47.3 和 47.3 ms，差值 −0.08 ms，p = .994。',
        verdict: '不支持',
        tone: 'no'
      },
      {
        id: 'H3',
        experiment: '目标隔离选择性收益',
        result: '隔离条件在一致和不一致试次中分别慢 1.9 和 2.0 ms，没有只改善不一致试次。',
        verdict: '不支持',
        tone: 'no'
      },
      {
        id: 'H4',
        experiment: '视觉搜索经典效应',
        result: '特征搜索和混合联合搜索斜率分别为 −0.8 和 18.6 ms/item，差值 19.4 ms/item，p < .001。',
        verdict: '支持',
        tone: 'yes'
      },
      {
        id: 'H5',
        experiment: '颜色分区改进',
        result: '分区使搜索斜率降低 17.2 ms/item，p < .001；集合大小 24 时缩短 285.6 ms，大小 8 时缩短 10.5 ms。',
        verdict: '支持',
        tone: 'yes'
      },
      {
        id: 'H6',
        experiment: '大集合准确率',
        result: '集合大小 24 时，分区和混合条件正确率分别为 95.8% 和 98.3%，差值方向与预测相反，p = .339。',
        verdict: '不支持',
        tone: 'no'
      },
      {
        id: 'H7',
        experiment: '图形知觉经典效应',
        result: '共同尺度和纯角度的绝对误差分别为 7.38 和 8.13 个百分点，方向符合预测，差异不清晰，p = .411。',
        verdict: '方向一致',
        tone: 'partial'
      },
      {
        id: 'H8',
        experiment: '角度参照线改进',
        result: '纯角度和参照线条件误差分别为 8.13 和 8.37 个百分点，参照线没有降低误差，p = .770。',
        verdict: '不支持',
        tone: 'no'
      },
      {
        id: 'H9',
        experiment: '角度判断时间',
        result: '纯角度和参照线条件的中位判断时间分别为 8.03 和 9.02 秒；参照线慢 0.99 秒，p = .249。',
        verdict: '不支持',
        tone: 'no'
      }
    ],
    experiments: {
      flanker: {
        eyebrow: '实验一 · 选择性注意',
        title: 'Flanker 目标隔离',
        unit: 'ms',
        conditions: [
          { key: 'plain', label: '普通排列' },
          { key: 'isolated', label: '目标隔离' }
        ],
        rows: [
          { p: 'P01', plain: 130, isolated: 106.5 },
          { p: 'P02', plain: 4.5, isolated: -39 },
          { p: 'P03', plain: 80.5, isolated: 32 },
          { p: 'P04', plain: 37, isolated: 42 },
          { p: 'P05', plain: 65.5, isolated: 61.5 },
          { p: 'P06', plain: 65.5, isolated: 43.5 },
          { p: 'P07', plain: 24, isolated: 88.5 },
          { p: 'P08', plain: 14, isolated: 50.5 },
          { p: 'P09', plain: 26.5, isolated: 1.5 },
          { p: 'P10', plain: 52.5, isolated: 54.5 },
          { p: 'P11', plain: 97.5, isolated: 94.5 },
          { p: 'P12', plain: -30.5, isolated: 32 }
        ],
        means: { plain: 47.25, isolated: 47.33 },
        classic: {
          result: '普通排列下不一致刺激比一致刺激慢 47.3 ms，95% CI [19.3, 75.2]，t(11) = 3.73，p = .003。',
          comparison: 'Eriksen 与 Eriksen（1974）发现，反应不兼容的侧翼刺激会比兼容刺激造成更大的反应时损失。本研究观察到相同方向的显著干扰效应，经典效应得到复现。',
          supported: true
        },
        improvement: {
          label: '目标隔离收益',
          value: -0.08,
          ci: [-23.82, 23.66],
          t: -0.01,
          p: 0.994,
          dz: -0.002,
          conclusion: '目标框没有减小 Flanker 干扰。普通排列和目标隔离的平均干扰效应几乎相同，因此本次视觉隔离改进无效。',
          effective: false
        },
        source: {
          label: 'Eriksen & Eriksen (1974)',
          url: 'https://doi.org/10.3758/BF03203267'
        }
      },
      search: {
        eyebrow: '实验二 · 视觉搜索',
        title: '颜色分区与搜索范围',
        unit: 'ms/item',
        conditions: [
          { key: 'feature', label: '特征搜索' },
          { key: 'grouped', label: '颜色分区' },
          { key: 'mixed', label: '混合联合' }
        ],
        rows: [
          { p: 'P01', feature: -0.41, grouped: 8.25, mixed: 20.13 },
          { p: 'P02', feature: -4.66, grouped: 2.44, mixed: 32.03 },
          { p: 'P03', feature: 0.34, grouped: -0.81, mixed: 7.31 },
          { p: 'P04', feature: -1.28, grouped: -0.09, mixed: 44.25 },
          { p: 'P05', feature: 0.47, grouped: -1.41, mixed: 5.88 },
          { p: 'P06', feature: 3.06, grouped: -3.44, mixed: 17.72 },
          { p: 'P07', feature: -0.63, grouped: -1.28, mixed: 18.47 },
          { p: 'P08', feature: 2.47, grouped: 1.59, mixed: 21.38 },
          { p: 'P09', feature: 0.69, grouped: 4.44, mixed: 16.88 },
          { p: 'P10', feature: -9.97, grouped: 0.50, mixed: 22.28 },
          { p: 'P11', feature: 2.16, grouped: 3.50, mixed: 11.13 },
          { p: 'P12', feature: -1.59, grouped: 3.41, mixed: 6.00 }
        ],
        means: { feature: -0.78, grouped: 1.42, mixed: 18.62 },
        classic: {
          result: '特征搜索斜率为 −0.8 ms/item，混合联合搜索为 18.6 ms/item；两者差值为 19.4 ms/item，95% CI [11.3, 27.5]，p < .001。',
          comparison: 'Treisman 与 Gelade（1980）提出，单一特征可近似并行加工，特征联合需要聚焦注意并随项目数增加而变慢。本研究呈现近乎平坦的特征搜索和明显上升的联合搜索，经典条件排序得到复现。',
          supported: true
        },
        improvement: {
          label: '颜色分区收益',
          value: 17.20,
          ci: [9.83, 24.56],
          t: 5.14,
          p: 0.000323,
          dz: 1.48,
          conclusion: '颜色分区把联合搜索斜率从 18.6 降至 1.4 ms/item，12 名被试的收益方向全部为正。本次颜色分区改进有效。',
          effective: true
        },
        source: {
          label: 'Treisman & Gelade (1980)',
          url: 'https://doi.org/10.1016/0010-0285(80)90005-5'
        },
        secondarySource: {
          label: 'Treisman (1982)',
          url: 'https://doi.org/10.1037/0096-1523.8.2.194'
        }
      },
      graphical: {
        eyebrow: '实验三 · 图形知觉',
        title: '图形编码与参照线',
        unit: '百分点',
        conditions: [
          { key: 'bar', label: '共同尺度' },
          { key: 'plain', label: '纯角度' },
          { key: 'guided', label: '角度+参照线' }
        ],
        rows: [
          { p: 'P01', bar: 4.17, plain: 5.82, guided: 5.25 },
          { p: 'P02', bar: 9.58, plain: 8.42, guided: 8.83 },
          { p: 'P03', bar: 5.17, plain: 4.33, guided: 2.58 },
          { p: 'P04', bar: 17.00, plain: 11.67, guided: 13.42 },
          { p: 'P05', bar: 6.00, plain: 5.42, guided: 10.83 },
          { p: 'P06', bar: 4.00, plain: 2.83, guided: 2.25 },
          { p: 'P07', bar: 13.00, plain: 16.67, guided: 20.83 },
          { p: 'P08', bar: 8.42, plain: 7.08, guided: 7.75 },
          { p: 'P09', bar: 4.83, plain: 6.83, guided: 6.25 },
          { p: 'P10', bar: 5.25, plain: 11.18, guided: 7.42 },
          { p: 'P11', bar: 3.33, plain: 6.50, guided: 7.83 },
          { p: 'P12', bar: 7.83, plain: 10.83, guided: 7.18 }
        ],
        means: { bar: 7.38, plain: 8.13, guided: 8.37 },
        classic: {
          result: '共同尺度平均绝对误差为 7.38 个百分点，纯角度为 8.13 个百分点；差值 0.75，95% CI [−1.18, 2.68]，p = .411。',
          comparison: 'Cleveland 与 McGill（1984）将共同尺度上的位置判断排在角度判断之前。本研究均值方向与该排序一致，但差异较小且不确定，属于方向一致、未获得清晰统计支持。',
          supported: null
        },
        improvement: {
          label: '角度参照线收益',
          value: -0.24,
          ci: [-1.98, 1.51],
          t: -0.30,
          p: 0.770,
          dz: -0.09,
          conclusion: '加入参照线后误差没有下降，均值反而略高 0.24 个百分点。该差异很小且置信区间跨过 0，本次参照线改进无效。',
          effective: false
        },
        source: {
          label: 'Cleveland & McGill (1984)',
          url: 'https://doi.org/10.1080/01621459.1984.10478080'
        }
      }
    }
  };
})(window);

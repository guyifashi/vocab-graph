// 🤖 由 Python 自动化流水线生成
const DB = {
  "day1": {
    "label": "Day 1 · 捆绑",
    "en": "bind",
    "icon": "🧵",
    "color": "#c6a84b",
    "nodes": [
      {
        "id": "bind",
        "type": "root",
        "name": "bind",
        "zh": "词根：捆绑",
        "ph": "[baind]",
        "pos": "v.",
        "logic": "",
        "related": [],
        "img": "./assets/bind.png",
        "notes": ""
      },
      {
        "id": "band",
        "type": "word",
        "name": "band",
        "zh": "条、带",
        "ph": "[bænd]",
        "pos": "n./v.",
        "logic": "元音字母互换，i -> a",
        "related": [],
        "img": "./assets/band.png",
        "notes": "条，带；乐队；波段；⼀群，⼀伙 v. 缚，绑扎（捆绑）"
      },
      {
        "id": "bandage",
        "type": "word",
        "name": "bandage",
        "zh": "绷带",
        "ph": "['bændidʒ]",
        "pos": "n.",
        "logic": "band+age 捆绑的带⼦",
        "related": [],
        "img": "./assets/bandage.png",
        "notes": "n. 绷带 v. ⽤绷带扎缚"
      },
      {
        "id": "bound",
        "type": "word",
        "name": "bound",
        "zh": "被束缚的",
        "ph": "[baund]",
        "pos": "adj.",
        "logic": "",
        "related": [],
        "img": "./assets/bound.png",
        "notes": "adj. 被束缚的，一定的；n. 界限 v.&n. 跳（跃）"
      },
      {
        "id": "boundce",
        "type": "word",
        "name": "boundce",
        "zh": "弹起",
        "ph": "[bauns]",
        "pos": "n.&vi.",
        "logic": "拟声词，类似中⽂文“蹦”",
        "related": [],
        "img": "",
        "notes": "n.&vi.（球）弹起，弹回；弹起，跳起；n. 弹⼒（拟声词，类似中⽂文“蹦”）"
      },
      {
        "id": "boundary",
        "type": "word",
        "name": "boundary",
        "zh": "分界线",
        "ph": "['baundəri]",
        "pos": "",
        "logic": "",
        "related": [],
        "img": "./assets/boundary.png",
        "notes": ""
      },
      {
        "id": "bond",
        "type": "word",
        "name": "bond",
        "zh": "结合",
        "ph": "[bɔnd]",
        "pos": "n.",
        "logic": "",
        "related": [],
        "img": "",
        "notes": "n. 结合（物），粘结（剂），联结；公债，债券；契约"
      },
      {
        "id": "bundle",
        "type": "word",
        "name": "bundle",
        "zh": "捆",
        "ph": "['bʌndl]",
        "pos": "n.",
        "logic": "",
        "related": [],
        "img": "./assets/bundle.png",
        "notes": ""
      },
      {
        "id": "bunch",
        "type": "word",
        "name": "bunch",
        "zh": "束",
        "ph": "['bʌntʃ]",
        "pos": "n.",
        "logic": "",
        "related": [],
        "img": "./assets/bunch.png",
        "notes": "（⼀）簇，束，捆，串。强调长在一起"
      },
      {
        "id": "husband",
        "type": "word",
        "name": "husband",
        "zh": "丈夫",
        "ph": "",
        "pos": "",
        "logic": "",
        "related": [],
        "img": "./assets/husband.png",
        "notes": "hus=house；与房⼦子绑定的⼈→丈夫"
      }
    ],
    "links": [
      {
        "source": "bind",
        "target": "band"
      },
      {
        "source": "band",
        "target": "bandage"
      },
      {
        "source": "bind",
        "target": "bound"
      },
      {
        "source": "bound",
        "target": "boundce"
      },
      {
        "source": "bound",
        "target": "boundary"
      },
      {
        "source": "bind",
        "target": "bond"
      },
      {
        "source": "bind",
        "target": "bundle"
      },
      {
        "source": "bind",
        "target": "bunch"
      },
      {
        "source": "bind",
        "target": "husband"
      }
    ]
  }
};

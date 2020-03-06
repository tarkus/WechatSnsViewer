# coding: utf-8
import json
import jieba.analyse
import imageio
import sys
import os
from wordcloud import WordCloud

import matplotlib
matplotlib.use('TkAgg')

jsonFile = "./data/exported_sns.json";
outputFile = "./data/{AUTHOR_ID}/word_art.png"


def gen_img(texts, img_file):
    data = ' '.join(text for text in texts)
    image_coloring = imageio.imread(img_file)
    wc = WordCloud(
        background_color='#f9f8fc',
        mask=image_coloring,
        font_path='/Library/Fonts/Songti.ttc'
    )
    wc.generate(data)
    output = outputFile.replace('{AUTHOR_ID}', authorId)
    outputDir = os.path.dirname(output)
    os.makedirs(outputDir, exist_ok=True)
    wc.to_file(output)
    print("成功生成词云")


if __name__ == '__main__':
    authorId = ""
    timeline = json.loads(open(jsonFile, 'r', encoding='utf-8').read())
    print('朋友圈总条目数：', len(timeline))

    words = []
    jieba.analyse.set_stop_words('./stop_words.txt')
    for entry in timeline:
        if authorId and authorId != entry['authorId']:
            raise ValueError('inconsistent authorId')
        else:
            authorId = entry['authorId']
        words.extend(jieba.analyse.extract_tags(entry['content']))
    print("总词数：", len(words))

    #gen_img(words, 'assets/wechat.png')
    gen_img(words, './owl.jpg')

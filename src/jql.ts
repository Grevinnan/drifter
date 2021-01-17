import _ from 'lodash';

export function concatJql(jql: string, expr: string) {
  if (jql) {
    return `${jql} AND ${expr}`;
  }
  return expr;
}

export function quoteList(strList: string): string {
  let elements = strList.split(',');
  elements = _.filter(elements, (x) => x !== '');
  return elements.map((x: string) => `"${x}"`).join(',');
}

export default function commandDirOptions(): any {
  return {
    extensions: process.env.NODE_ENV === 'development' ? ['js', 'ts'] : ['js'],
  };
}

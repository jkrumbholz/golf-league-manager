import subprocess
import boto3
import os, tempfile, gzip
import argparse
import time

session = boto3.Session()

BUCKET_BASE = 'golfleague-krummy-net-hosting'
SITE_DOMAIN = 'golfleague.krummy.net'


def build_angular_app(build_folder):
    print('building: ' + environment)
    command = f"ng build --output-hashing=all --output-path={build_folder}"
    command = f"{command} --configuration={environment}"
    p = subprocess.Popen([command], shell=True)
    p.wait()
    if p.returncode != 0:
        raise SystemExit(f"ng build failed with exit code {p.returncode}")
    print('build is done')


def gzip_to_key(source_file, key, bucket_name):
    s3 = session.resource('s3')

    # Create temp gzip file
    with tempfile.NamedTemporaryFile(mode="wb", suffix=".gz", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        # Write gzipped content
        with open(source_file, 'rb') as f_in:
            with gzip.open(tmp_path, 'wb') as gz_out:
                gz_out.write(f_in.read())

        # Upload gzipped file
        with open(tmp_path, 'rb') as gz_file:
            s3.Object(bucket_name, key).put(
                Body=gz_file,
                ContentType=get_content_type(source_file),
                ContentEncoding='gzip'
            )

    finally:
        # Windows-safe cleanup
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def add_file(source_file, s3_key, bucket_name):
    s3 = session.resource('s3')

    if source_file.endswith((".js", ".css")):
        print(f"gzipping {source_file} → {s3_key}")
        gzip_to_key(source_file, s3_key, bucket_name)
    else:
        print(f"uploading {source_file} → {s3_key}")
        with open(source_file, 'rb') as f:
            s3.Object(bucket_name, s3_key).put(
                Body=f,
                ContentType=get_content_type(source_file)
            )


def get_content_type(source_file):
    content_type = "application/octet"
    if source_file.endswith('html'):
        content_type = 'text/html'
    elif source_file.endswith('js'):
        content_type = 'text/javascript'
    elif source_file.endswith('css'):
        content_type = 'text/css'
    return content_type


def dir_to_bucket(src_directory, bucket):
    """recursively copy files from source directory to boto bucket"""
    exclude = [".git", ".idea", ".DS_Store", "deploy.py", "less", "scss"]
    for root, sub_folders, files in os.walk(src_directory):
        sub_folders[:] = [d for d in sub_folders if d not in exclude]
        files[:] = [d for d in files if d not in exclude]
        for file in files:
            abs_path = os.path.join(root, file)
            rel_path = os.path.relpath(abs_path, src_directory)
            add_file(abs_path, rel_path, bucket)
    print('Done uploading files to S3')


def get_distribution_id_by_domain(domain_name):
    # Create a CloudFront client
    client = boto3.client('cloudfront')

    # List all CloudFront distributions
    paginator = client.get_paginator('list_distributions')
    for page in paginator.paginate():
        dist_list = page.get('DistributionList', {})
        if dist_list.get('Items'):
            for distribution in dist_list['Items']:
                aliases = distribution['Aliases'].get('Items', [])
                if domain_name in aliases:
                    return distribution['Id']

    return None


def invalidate_distribution(distribution_id, paths=None):
    if paths is None:
        paths = ['/*']  # Invalidate everything by default

    client = boto3.client('cloudfront')

    # CallerReference must be unique for each invalidation
    caller_reference = f"invalidate-{int(time.time())}"

    response = client.create_invalidation(
        DistributionId=distribution_id,
        InvalidationBatch={
            'Paths': {
                'Quantity': len(paths),
                'Items': paths
            },
            'CallerReference': caller_reference
        }
    )

    invalidation_id = response['Invalidation']['Id']
    status = response['Invalidation']['Status']
    print(f"✅ Created invalidation {invalidation_id} for {distribution_id} (status: {status})")

    return response


def main(environment):
    build_folder = environment + '-build'
    bucket_name = BUCKET_BASE
    url = SITE_DOMAIN

    if(environment != "production"):
        bucket_name = f"{environment}-{bucket_name}"
    else:
        bucket_name = f"prod-{bucket_name}"

    if(environment != "production"):
        url = f"{environment}.{url}"

    build_angular_app(build_folder)

    print(f"Uploadinng to bucket {bucket_name}")
    dir_to_bucket('./' + build_folder + '/browser/', bucket_name)
    distribution_id = get_distribution_id_by_domain(url)
    if distribution_id is None:
        print(f"No CloudFront distribution found for {url}. Skipping invalidation.")
        return
    print(f"Invalidating distribution {distribution_id} for {url}")
    invalidate_distribution(distribution_id, ['/*'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Deploy the Golf League Manager frontend")
    parser.add_argument(
        "--env",
        default="dev",
        choices=["dev", "production"],
        help="Environment to deploy (dev|production)"
    )
    args = parser.parse_args()
    environment = args.env

    reply = input('Are you sure you want to deploy the ' + environment + ' environment? (y/n)')
    if reply == 'y':
        main(environment)
    else:
        print('Cancelling build...')

#To run Python on Mac
#source ~/Projects/python_environments/python311/bin/activate;
